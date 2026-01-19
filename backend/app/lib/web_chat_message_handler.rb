require 'base64'
require 'digest'
require 'image_processing/mini_magick'
require 'securerandom'
require 'stringio'
require 'chat_flow_engine'
require 'chat_helpers/event_candidates'
require 'chat_helpers/ai_logging'
require 'chat_helpers/calendar_actions'
require 'chat_helpers/confirmations'
require 'chat_helpers/extraction'
require 'chat_helpers/event_query'
require 'chat_helpers/event_handlers'
require 'chat_helpers/memory_actions'
require 'chat_helpers/memory_handlers'
require 'chat_helpers/payloads'
require 'chat_helpers/formatters'
require 'chat_helpers/selection'
require 'chat_helpers/state'
require 'chat_helpers/time_helpers'
require 'chat_helpers/intent_handlers'
require 'chat_helpers/transaction_actions'
require 'chat_helpers/transaction_handlers'

class WebChatMessageHandler
  include ChatHelpers::EventCandidates
  include ChatHelpers::AiLogging
  include ChatHelpers::CalendarActions
  include ChatHelpers::Confirmations
  include ChatHelpers::Extraction
  include ChatHelpers::EventQuery
  include ChatHelpers::EventHandlers
  include ChatHelpers::MemoryActions
  include ChatHelpers::MemoryHandlers
  include ChatHelpers::Payloads
  include ChatHelpers::Formatters
  include ChatHelpers::Selection
  include ChatHelpers::State
  include ChatHelpers::TimeHelpers
  include ChatHelpers::IntentHandlers
  include ChatHelpers::TransactionActions
  include ChatHelpers::TransactionHandlers
  CONFIDENCE_ORDER = { 'low' => 0, 'medium' => 1, 'high' => 2 }.freeze
  CALENDAR_WINDOW_FUTURE_DAYS = 90
  CALENDAR_WINDOW_PAST_DAYS = 30
  MAX_GEMINI_DIMENSION = 1568
  IDEMPOTENCY_WINDOW_SECONDS = 120

  def initialize(user:, message:, text:, image: nil, thread:)
    @user = user
    @message = message
    @text = text.to_s
    @image = image
    @thread = thread
    @correlation_id = SecureRandom.hex(10)
  end

  def process!
    return handle_pending_action if pending_action?

    intent = classify_intent
    intent_name = intent['intent'] || 'create_event'
    intent_confidence = normalize_confidence(intent['confidence'])

    if intent_confidence == 'low' || intent_name == 'ambiguous'
      return image_attached? ? ask_image_intent : ask_intent_clarification
    end

    case intent_name
    when 'create_event'
      handle_create_event
    when 'update_event'
      handle_update_event
    when 'delete_event'
      handle_delete_event
    when 'create_transaction'
      handle_create_transaction
    when 'create_memory'
      handle_create_memory
    when 'search_memory'
      handle_search_memory
    when 'list_events'
      handle_list_events
    when 'digest'
      build_response("I can send daily/weekly digests soon. (Calendar querying comes next.)")
    when 'help'
      build_response("Send event details and I’ll add it to your calendar.")
    else
      build_response("Tell me what you’d like to do with your calendar or finances.")
    end
  end

  private

  def flow_engine
    @flow_engine ||= ChatFlowEngine.new(self)
  end

  def text
    @text
  end

  def message
    @message
  end

  def text_context
    @text.presence || recent_context_text
  end

  def pending_action?
    thread_state['pending_action'].present?
  end


  def ask_image_intent
    set_pending_action('clarify_image_intent', { 'image_message_id' => @message.id })
    build_response("Is this image for a calendar event or a transaction?")
  end

  def ask_intent_clarification
    set_pending_action('clarify_intent', { 'image_message_id' => image_attached? ? @message.id : nil })
    build_response("Do you want me to add or update a calendar event, delete an event, add a transaction, or save a memory?")
  end

  def handle_pending_action
    action = thread_state['pending_action']
    payload = thread_state['payload'] || {}

    case action
    when 'clarify_image_intent', 'clarify_intent'
      return handle_clarified_intent(payload)
    when 'clarify_event_fields'
      return handle_event_correction(payload)
    when 'confirm_event'
      return handle_event_confirmation(payload)
    when 'clarify_transaction_fields'
      return handle_transaction_correction(payload)
    when 'confirm_transaction'
      return handle_transaction_confirmation(payload)
    when 'select_event_for_delete'
      return handle_event_selection(payload, action_type: 'delete')
    when 'confirm_delete'
      return handle_delete_confirmation(payload)
    when 'clarify_delete_target'
      return handle_delete_target_clarification(payload)
    when 'select_event_for_update'
      return handle_event_selection(payload, action_type: 'update')
    when 'select_event_from_extraction'
      return handle_event_extraction_selection(payload)
    when 'select_transaction_from_extraction'
      return handle_transaction_extraction_selection(payload)
    when 'confirm_update'
      return handle_update_confirmation(payload)
    when 'clarify_update_changes'
      return handle_update_changes_clarification(payload)
    when 'clarify_update_target'
      return handle_update_target_clarification(payload)
    when 'clarify_recurring_scope'
      return handle_recurring_scope_clarification(payload)
    when 'clarify_list_query'
      return handle_list_query_clarification(payload)
    when 'clarify_memory_fields'
      return handle_memory_correction(payload)
    when 'confirm_memory'
      return handle_memory_confirmation(payload)
    else
      clear_thread_state
      build_response("Let’s start over. What would you like to do?")
    end
  end

  def render_extraction_result(event)
    if event['error']
      "What is the title, date, and time?"
    else
      [
        "I found an event:",
        format_event(event),
        "Reply with any changes."
      ].compact.join("\n\n")
    end
  end

  def normalize_confidence(value)
    return 'medium' if value.to_s.empty?

    normalized = value.to_s.downcase
    return normalized if CONFIDENCE_ORDER.key?(normalized)

    'medium'
  end

  def missing_event_fields(event)
    missing = []
    missing << 'a title' if event['title'].to_s.strip.empty?
    missing << 'a date' if event['date'].to_s.strip.empty?
    missing
  end

  def missing_transaction_fields(transaction)
    missing = []
    missing << 'a merchant' if transaction['merchant'].to_s.strip.empty?
    missing << 'an amount' if transaction['amount'].to_s.strip.empty?
    missing << 'a date' if transaction['date'].to_s.strip.empty?
    if transaction['source'].to_s.strip.empty?
      missing << 'a source'
    elsif !TransactionSources.valid?(transaction['source'])
      missing << 'a valid source'
    end
    missing
  end

  def recent_context_text(limit: 10)
    scope = ChatMessage.where(transport: @message.transport)
    if @thread.thread_id.present?
      scope = scope.where(thread_id: @thread.thread_id)
    else
      scope = scope.where(external_id: @message.external_id)
    end

    messages = scope.where.not(id: @message.id)
      .order(created_at: :desc)
      .limit(limit)
      .to_a
      .reverse

    lines = messages.map { |msg| format_context_line(msg) }.compact
    lines.join("\n")
  end

  def normalize_title(title)
    title.to_s.downcase.gsub(/[^a-z0-9\s]/, ' ').squeeze(' ').strip
  end

  def tokenize_title(title)
    normalize_title(title).split(' ').reject(&:empty?)
  end

  def symbolize_candidate(entry)
    event = CalendarEvent.find_by(id: entry['id'])
    return nil unless event

    { event: event, score: 0 }
  end

  def normalize_recurrence(recurrence)
    return nil if recurrence.nil?

    if recurrence.is_a?(String)
      cleaned = recurrence.strip
      return nil if cleaned.empty?
      return cleaned
    end

    return nil unless recurrence.is_a?(Hash)

    data = recurrence.transform_keys(&:to_s)
    freq = data['frequency'].to_s.downcase
    return nil if freq.empty?

    data['frequency'] = freq
    data['by_day'] = Array(data['by_day']).map(&:to_s).map(&:upcase).uniq
    data['interval'] = data['interval'].to_i if data['interval']
    data['count'] = data['count'].to_i if data['count']
    data
  end


  def build_recurrence_rules(recurrence, start_date: nil)
    return nil if recurrence.nil?

    if recurrence.is_a?(String)
      rule = recurrence.strip
      return nil if rule.empty?
      rule = "RRULE:#{rule}" unless rule.start_with?('RRULE:')
      return [rule]
    end

    return nil unless recurrence.is_a?(Hash)

    freq = recurrence['frequency'].to_s.upcase
    return nil if freq.empty?

    parts = ["FREQ=#{freq}"]
    interval = recurrence['interval'].to_i
    parts << "INTERVAL=#{interval}" if interval.positive?

    by_day = Array(recurrence['by_day']).map(&:to_s).map(&:upcase).uniq
    if by_day.empty? && freq == 'WEEKLY' && start_date.present?
      begin
        day_code = start_date.is_a?(Date) ? start_date.strftime('%a').upcase[0, 2] : Date.parse(start_date.to_s).strftime('%a').upcase[0, 2]
        by_day = [day_code]
      rescue ArgumentError
      end
    end
    parts << "BYDAY=#{by_day.join(',')}" if by_day.any?

    count = recurrence['count'].to_i
    parts << "COUNT=#{count}" if count.positive?

    if recurrence['until'].present?
      begin
        until_date = Date.parse(recurrence['until'].to_s)
        parts << "UNTIL=#{until_date.strftime('%Y%m%d')}"
      rescue ArgumentError
      end
    end

    ["RRULE:#{parts.join(';')}"]
  end


  def recurring_event?(event_record)
    raw = event_record.raw_event || {}
    raw['recurringEventId'].present? || raw['recurrence'].present? || raw['originalStartTime'].present?
  end

  def recurring_master_event_id(event_record)
    raw = event_record.raw_event || {}
    raw['recurringEventId'].presence || event_record.event_id
  end

  def build_event_updates(event_record, changes)
    date = changes['date'].presence || event_record.start_at&.to_date&.iso8601
    start_time = changes['start_time'].presence || event_record.start_at&.strftime('%H:%M')
    duration_minutes = changes['duration_minutes'].to_i if changes['duration_minutes'].present?
    end_time = changes['end_time'].presence

    return nil if date.to_s.empty?

    if end_time.to_s.empty? && duration_minutes.to_i.positive?
      base_time = if changes['start_time'].present?
        Time.zone.parse("#{date} #{start_time}")
      else
        event_record.start_at
      end
      if base_time
        end_time = (base_time + duration_minutes.minutes).strftime('%H:%M')
      end
    end
    end_time = event_record.end_at&.strftime('%H:%M') if end_time.to_s.empty?

    recurrence_rules = nil
    if changes['recurrence_clear']
      recurrence_rules = []
    elsif changes['recurrence']
      recurrence_rules = build_recurrence_rules(changes['recurrence'], start_date: date)
    end

    {
      'title' => changes['title'].presence || event_record.title,
      'date' => date,
      'start_time' => start_time,
      'end_time' => end_time,
      'location' => changes['location'].presence || event_record.location,
      'description' => changes['description'].presence || event_record.description,
      'recurrence_rules' => recurrence_rules,
      'recurrence_clear' => changes['recurrence_clear']
    }.compact
  end


  def normalize_source(source)
    TransactionSources.normalize(source)
  end

  def affirmative?
    @text.match?(/\b(yes|yep|yeah|sure|do it|ok|okay|confirm)\b/i)
  end

  def image_attached?
    @image&.attached?
  end

  def image_mime_type
    @image&.content_type || 'image/png'
  end

  def gemini_image_payload(image)
    raw = image.download
    resized = resize_image_bytes(raw, image.content_type)
    [Base64.strict_encode64(resized), image.content_type || 'image/png']
  end

  def resize_image_bytes(bytes, content_type)
    return bytes unless content_type.to_s.start_with?('image/')

    ImageProcessing::MiniMagick
      .source(StringIO.new(bytes))
      .resize_to_limit(MAX_GEMINI_DIMENSION, MAX_GEMINI_DIMENSION)
      .call
      .tap(&:rewind)
      .read
  rescue StandardError
    bytes
  end

  def gemini_extract_model
    ENV.fetch('GEMINI_EXTRACT_MODEL', 'gemini-3-flash-preview')
  end

  def gemini_intent_model
    ENV.fetch('GEMINI_INTENT_MODEL', 'gemini-2.0-flash')
  end

  def gemini
    @gemini ||= GeminiVision.new
  end

  def spouse_emails(user)
    User.where(active: true).where.not(id: user.id).pluck(:email)
  end

  def household_users
    emails = (spouse_emails(@user) + [@user.email]).uniq
    User.where(email: emails)
  end

  def event_date(result)
    if result.start&.date
      result.start.date
    else
      result.start&.date_time&.to_date
    end
  end

  def event_time(result)
    return nil if result.start&.date

    result.start&.date_time&.strftime('%H:%M')
  end

  def event_time_range(result)
    return 'All day' if result.start&.date

    start_time = result.start&.date_time&.strftime('%H:%M')
    end_time = result.end&.date_time&.strftime('%H:%M')
    return start_time if start_time && end_time.to_s.empty?

    [start_time, end_time].compact.join(' - ')
  end

  def event_record_date(record)
    record.start_at&.to_date
  end

  def event_record_time_range(record)
    return 'All day' if record.start_at&.to_time&.hour == 0 && record.end_at&.to_time&.hour == 0

    start_time = record.start_at&.strftime('%H:%M')
    end_time = record.end_at&.strftime('%H:%M')
    return start_time if start_time && end_time.to_s.empty?

    [start_time, end_time].compact.join(' - ')
  end

  def scope_label(scope, detached_instance:)
    return 'this event only (detached)' if detached_instance

    scope == 'series' ? 'entire series' : 'this event only'
  end

  def token_fingerprint(token)
    return nil if token.to_s.empty?

    Digest::SHA256.hexdigest(token.to_s)[0, 12]
  end

  def log_action(message, calendar_event_id:, calendar_id:, status:, action_type:, metadata: {})
    metadata = metadata.dup
    metadata[:correlation_id] = @correlation_id unless metadata.key?(:correlation_id) || metadata.key?('correlation_id')
    ChatAction.create!(
      chat_message: message,
      calendar_event_id: calendar_event_id,
      calendar_id: calendar_id,
      transport: 'web',
      action_type: action_type,
      status: status,
      metadata: metadata
    )
  end

  def clarify_missing_details(intent:, missing_fields:, extracted:, fallback:, extra: nil)
    response = gemini.clarify_missing_details(
      intent: intent,
      missing_fields: missing_fields,
      extracted: extracted,
      context: recent_context_text,
      extra: extra
    )
    log_ai_text(
      response[:text],
      usage: response[:usage],
      request_kind: 'clarify_missing_details',
      model: gemini_intent_model,
      response: { text: response[:text], intent: intent, missing_fields: missing_fields, extracted: extracted, extra: extra }
    )
    response[:text].presence || fallback
  rescue StandardError => e
    Rails.logger.warn("[ChatClarify] Failed to generate question intent=#{intent} error=#{e.message}")
    fallback
  end

  def resolve_recurring_scope(text)
    result = gemini.extract_recurring_scope_from_text(text, context: recent_context_text)
    log_ai_result(result, request_kind: 'recurring_scope', model: gemini_intent_model)
    data = result[:event] || {}
    scope = data['recurring_scope'].to_s
    scope = nil if scope.empty? || scope == 'unspecified'
    {
      scope: scope,
      recurrence_clear: data['recurrence_clear'] == true
    }
  rescue StandardError
    { scope: nil, recurrence_clear: false }
  end

  def build_response(text, event_created: false, action: nil, error_code: nil)
    { text: text, event_created: event_created, action: action, error_code: error_code }.compact
  end

  public :build_response,
         :clarify_missing_details,
         :create_event,
         :create_memory,
         :create_transaction,
         :extract_event_from_message,
         :extract_from_image,
         :extract_from_text,
         :extract_memory_from_text,
         :extract_transaction_from_image,
         :extract_transaction_from_message,
         :extract_transaction_from_text,
         :extract_urls,
         :extracted_events,
         :extracted_transactions,
         :format_event,
         :format_extracted_candidates,
         :format_extracted_transactions,
         :format_memory,
         :format_transaction,
         :image_attached?,
         :message,
         :missing_event_fields,
         :missing_memory_fields,
         :missing_transaction_fields,
         :normalize_confidence,
         :normalize_recurrence,
         :set_pending_action,
         :strip_urls,
         :text,
         :text_context
end
