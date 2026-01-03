require 'base64'
require 'net/http'

class SlackMessageHandler
  def initialize(payload)
    @payload = payload.deep_stringify_keys
  end

  def process!
    message = create_chat_message
    text = response_text(message)
    client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: text,
      mrkdwn: true
    )
  rescue StandardError => e
    Rails.logger.error "[Slack] Failed to process message: #{e.message}"
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
      "I can list upcoming events soon. (Calendar querying comes next.)"
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
    log_ai_request(message, result[:usage], request_kind: 'image', model: gemini_extract_model, status: result[:event]['error'] ? 'error' : 'success')
    handle_event_creation(message, result[:event])
  rescue StandardError => e
    log_ai_request(message, {}, request_kind: 'image', model: gemini_extract_model, status: 'error', error_message: e.message)
    "Image extraction error: #{e.message}"
  end

  def extract_from_text(message)
    result = gemini.extract_event_from_text(cleaned_text)
    log_ai_request(message, result[:usage], request_kind: 'text', model: gemini_extract_model, status: result[:event]['error'] ? 'error' : 'success')
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
    return render_extraction_result(event) if event['error']

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

    calendar = GoogleCalendarClient.new(user)
    attendees = (spouse_emails(user) + [user.email]).uniq
    result = calendar.create_event(event, attendees: attendees, guests_can_modify: true)

    CalendarEvent.create!(
      user: user,
      calendar_id: 'primary',
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

    [
      "Added to your calendar! ✅",
      "Title: #{result.summary}",
      "Date: #{event_date(result)}",
      "Time: #{event_time(result)}",
      "Link: #{result.html_link}"
    ].compact.join("\n")
  rescue GoogleCalendarClient::CalendarError => e
    "Calendar error: #{e.message}"
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

  def log_ai_request(message, usage, request_kind:, model:, status:, error_message: nil)
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
      usage_metadata: usage
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
    log_ai_request(message, result[:usage], request_kind: 'intent', model: gemini_intent_model, status: result[:event]['error'] ? 'error' : 'success')
    result[:event]
  rescue StandardError => e
    log_ai_request(message, {}, request_kind: 'intent', model: gemini_intent_model, status: 'error', error_message: e.message)
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
end
