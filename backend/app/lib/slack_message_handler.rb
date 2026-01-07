require 'base64'
require 'net/http'
require 'securerandom'

class SlackMessageHandler
  def initialize(payload)
    @payload = payload.deep_stringify_keys
    @correlation_id = SecureRandom.hex(10)
  end

  def process!
    message = create_chat_message
    text = response_text(message)
    response = client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: text,
      mrkdwn: true
    )
    SlackMessageLog.create!(
      chat_message: message,
      user_id: resolve_user(message)&.id,
      channel: channel,
      thread_ts: thread_ts,
      status: 'success',
      response: response.to_h
    )
  rescue StandardError => e
    Rails.logger.error "[Slack] Failed to process message: #{e.message}"
    if defined?(message) && message
      ChatAction.create!(
        chat_message: message,
        calendar_event_id: nil,
        calendar_id: nil,
        transport: 'slack',
        action_type: 'chat_error',
        status: 'error',
        metadata: {
          error: e.message,
          error_code: 'chat_processing_failed',
          correlation_id: @correlation_id,
          backtrace: e.backtrace&.first(10)
        }
      )
    end
    SlackMessageLog.create!(
      chat_message: (defined?(message) && message ? message : nil),
      user_id: (defined?(message) && message ? resolve_user(message)&.id : nil),
      channel: channel,
      thread_ts: thread_ts,
      status: 'error',
      error: e.message,
      response: {}
    )
    client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: "Error: #{e.message}"
    )
  end

  private

  def response_text(message)
    intent = classify_intent(message)

    case intent['intent']
    when 'list_events'
      handle_list_events(message)
    when 'digest'
      "I can send daily/weekly digests soon. (Calendar querying comes next.)"
    when 'help'
      "Send event details or a screenshot and I’ll create it on your calendar."
    else
      if image_files.any?
        extract_from_image(message)
      elsif cleaned_text.present?
        extract_from_text(message)
      else
        "Slack is wired up. Send a message or image to test."
      end
    end
  end

  def cleaned_text
    text = @payload['text'].to_s
    text.gsub(/<@[A-Z0-9]+>/, '').strip
  end

  def image_files
    Array(@payload['files']).select do |file|
      file['mimetype'].to_s.start_with?('image/')
    end
  end

  def extract_from_image(message)
    file = image_files.first
    base64 = download_file(file['url_private_download'] || file['url_private'])
    result = gemini.extract_event_from_image(base64, mime_type: file['mimetype'])
    log_ai_request(
      message,
      result[:usage],
      request_kind: 'image',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    handle_event_creation(message, result[:event])
  rescue StandardError => e
    log_ai_request(
      message,
      {},
      request_kind: 'image',
      model: gemini_extract_model,
      status: 'error',
      error_message: e.message,
      metadata: ai_metadata
    )
    "Image extraction error: #{e.message}"
  end

  def extract_from_text(message)
    result = gemini.extract_event_from_text(cleaned_text)
    log_ai_request(
      message,
      result[:usage],
      request_kind: 'text',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    handle_event_creation(message, result[:event])
  end

  def render_extraction_result(event)
    if event['error']
      event['message'] || "I couldn't find event details in that message."
    else
      [
        "I found an event:",
        format_event(event),
        "Reply with any changes. (Calendar creation comes next.)"
      ].compact.join("\n\n")
    end
  end

  def handle_event_creation(message, event)
    if event['error']
    log_action(message, calendar_event: nil, status: 'error', metadata: { error: event['message'], correlation_id: @correlation_id })
      return render_extraction_result(event)
    end

    user = resolve_user(message)
    unless user
      return [
        "I couldn't match your Slack user to a Jarvis account.",
        "Debug:",
        "slack_user_id: #{@payload['user']}",
        "event_type: #{@payload['event_type'] || 'unknown'}",
        "channel_type: #{@payload['channel_type'] || 'unknown'}",
        "payload_keys: #{@payload.keys.sort.join(', ')}",
        "slack_email: #{slack_user_email || 'nil'}",
        "stored_sender_email: #{message.sender_email || 'nil'}",
        "active_users: #{User.where(active: true).pluck(:email).join(', ')}"
      ].join("\n")
    end
    return "Please connect your calendar at https://finances.sifxtre.me first." if user.google_refresh_token.to_s.empty?

    calendar_id = primary_calendar_id_for(user)
    calendar = GoogleCalendarClient.new(user)
    attendees = (spouse_emails(user) + [user.email]).uniq
    event['recurrence'] = normalize_recurrence(event['recurrence'])
    recurrence_rules = build_recurrence_rules(event['recurrence'], start_date: event['date'])
    result = calendar.create_event(
      event,
      calendar_id: calendar_id,
      attendees: attendees,
      guests_can_modify: true,
      recurrence_rules: recurrence_rules
    )

    calendar_event = CalendarEvent.create!(
      user: user,
      calendar_id: calendar_id,
      event_id: result.id,
      title: result.summary,
      description: result.description,
      location: result.location,
      start_at: result.start&.date_time,
      end_at: result.end&.date_time,
      attendees: attendees.map { |email| { email: email } },
      raw_event: result.to_h,
      source: 'slack'
    )

    log_action(
      message,
      calendar_event: calendar_event,
      status: 'success',
      metadata: {
        event_id: calendar_event.event_id,
        title: calendar_event.title,
        calendar_request: { event: event, attendees: attendees, calendar_id: calendar_id, recurrence_rules: recurrence_rules },
        calendar_response: result.to_h,
        correlation_id: @correlation_id
      }
    )

    [
      "Added to your calendar! ✅",
      "Title: #{result.summary}",
      "Date: #{event_date(result)}",
      "Time: #{event_time(result)}",
      "Link: #{result.html_link}"
    ].compact.join("\n")
  rescue GoogleCalendarClient::CalendarError => e
    log_action(message, calendar_event: nil, status: 'error', metadata: { error: e.message })
    "Calendar error: #{e.message}"
  end

  def handle_list_events(message)
    user = resolve_user(message)
    unless user
      return "I couldn't match your Slack user to a Jarvis account. Please sign in on the web app first."
    end

    query = gemini.extract_event_query_from_text(cleaned_text, context: nil)
    log_ai_request(
      message,
      query[:usage],
      request_kind: 'event_query',
      model: gemini_intent_model,
      status: query[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: query[:event])
    )
    data = query[:event] || {}
    title = data['title'].to_s.strip
    date = data['date'].to_s.strip

    scope = CalendarEvent.where(user: user).where.not(status: 'cancelled')
    scope = scope.where(start_at: Time.zone.now..(Time.zone.now + 90.days))
    if date.present?
      day = Date.parse(date) rescue nil
      scope = scope.where(start_at: day.beginning_of_day..day.end_of_day) if day
    end
    scope = scope.where("title ILIKE ?", "%#{title}%") if title.present?
    events = scope.order(:start_at).limit(5).to_a

    if events.empty?
      return "I couldn't find any upcoming events that match."
    end

    lines = events.map { |event| format_event_brief(event) }
    title.present? ? "Here are the next matches:\n#{lines.join("\n")}" : "Here are the next events:\n#{lines.join("\n")}"
  rescue StandardError => e
    "List error: #{e.message}"
  end

  def primary_calendar_id_for(user)
    user.calendar_connections.find_by(primary: true)&.calendar_id || user.email || 'primary'
  end

  def format_event(event)
    lines = []
    lines << "Title: #{event['title']}" if event['title'].present?
    lines << "Date: #{event['date']}" if event['date'].present?
    time_range = [event['start_time'], event['end_time']].compact.join(' - ')
    lines << "Time: #{time_range}" if time_range.present?
    lines << "Location: #{event['location']}" if event['location'].present?
    lines << "Details: #{event['description']}" if event['description'].present?
    lines.join("\n")
  end

  def download_file(url)
    token = ENV['SLACK_BOT_TOKEN'].to_s
    raise "Missing SLACK_BOT_TOKEN" if token.empty?
    raise "Missing file URL" if url.to_s.empty?

    uri = URI(url)
    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{token}"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    raise "Slack download failed: #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    Base64.strict_encode64(response.body)
  end

  def channel
    @payload['channel']
  end

  def thread_ts
    @payload['thread_ts'] || @payload['ts']
  end

  def client
    @client ||= ::Slack::Web::Client.new(token: ENV['SLACK_BOT_TOKEN'])
  end

  def gemini
    @gemini ||= GeminiVision.new
  end

  def create_chat_message
    sender_email = slack_user_email
    ChatMessage.create!(
      transport: 'slack',
      external_id: channel,
      thread_id: thread_ts,
      message_ts: @payload['ts'],
      sender_id: @payload['user'],
      sender_email: sender_email,
      text: cleaned_text.presence,
      has_image: image_files.any?,
      raw_payload: @payload
    )
  end

  def ai_metadata(response: nil, request: nil, extra: {})
    base_request = request || { text: cleaned_text, has_image: image_files.any? }
    { request: base_request, response: response, correlation_id: @correlation_id }.merge(extra).compact
  end

  def log_ai_request(message, usage, request_kind:, model:, status:, error_message: nil, metadata: {})
    usage ||= {}
    AiRequest.create!(
      chat_message: message,
      transport: 'slack',
      model: model,
      request_kind: request_kind,
      prompt_tokens: usage['promptTokenCount'],
      output_tokens: usage['candidatesTokenCount'],
      total_tokens: usage['totalTokenCount'],
      cost_usd: estimate_cost(usage, model),
      status: status,
      error_message: error_message,
      usage_metadata: usage.merge('context' => metadata)
    )
  end

  def estimate_cost(usage, model)
    prompt = usage['promptTokenCount']
    output = usage['candidatesTokenCount']
    return nil if prompt.nil? || output.nil?

    rates = model_rates(model)
    input_cost = (prompt.to_f / 1_000_000) * rates[:input]
    output_cost = (output.to_f / 1_000_000) * rates[:output]
    (input_cost + output_cost).round(6)
  end

  def model_rates(model)
    case model
    when 'gemini-2.0-flash'
      { input: 0.10, output: 0.40 }
    when 'gemini-2.5-flash'
      { input: 0.30, output: 2.50 }
    else
      { input: 0.50, output: 3.00 }
    end
  end

  def gemini_extract_model
    ENV.fetch('GEMINI_EXTRACT_MODEL', 'gemini-3-flash-preview')
  end

  def gemini_intent_model
    ENV.fetch('GEMINI_INTENT_MODEL', 'gemini-2.0-flash')
  end

  def classify_intent(message)
    result = gemini.classify_intent(text: cleaned_text, has_image: image_files.any?)
    log_ai_request(
      message,
      result[:usage],
      request_kind: 'intent',
      model: gemini_intent_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result[:event]
  rescue StandardError => e
    log_ai_request(
      message,
      {},
      request_kind: 'intent',
      model: gemini_intent_model,
      status: 'error',
      error_message: e.message,
      metadata: ai_metadata
    )
    { 'intent' => 'create_event' }
  end

  def resolve_user(message)
    slack_id = @payload['user'].to_s
    if slack_id.present?
      user = User.find_by(slack_user_id: slack_id, active: true)
      return user if user
    end

    email = message.sender_email || slack_user_email
    return nil if email.to_s.empty?

    User.find_by(email: email, active: true)
  end

  def spouse_emails(user)
    User.where(active: true).where.not(id: user.id).pluck(:email)
  end

  def slack_user_email
    user_id = @payload['user'].to_s
    return nil if user_id.empty?

    response = client.users_info(user: user_id)
    response&.user&.profile&.email
  rescue StandardError
    nil
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

  def format_event_brief(event)
    return event.title.to_s if event.start_at.nil?

    date_label = event.start_at.strftime('%b %d')
    time_label = event.start_at.strftime('%H:%M')
    end_label = event.end_at ? event.end_at.strftime('%H:%M') : nil
    time_range = end_label ? "#{time_label}-#{end_label}" : time_label
    "#{date_label} #{time_range} - #{event.title}"
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

  def log_action(message, calendar_event:, status:, metadata: {})
    metadata = metadata.dup
    metadata[:correlation_id] = @correlation_id unless metadata.key?(:correlation_id) || metadata.key?('correlation_id')
    ChatAction.create!(
      chat_message: message,
      calendar_event_id: calendar_event&.id,
      calendar_id: calendar_event&.calendar_id || 'primary',
      transport: 'slack',
      action_type: 'create_calendar_event',
      status: status,
      metadata: metadata
    )
  end
end
