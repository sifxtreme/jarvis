class WebChatMessageHandler
  def initialize(user:, message:, text:)
    @user = user
    @message = message
    @text = text.to_s
  end

  def process!
    intent = classify_intent

    case intent['intent']
    when 'list_events'
      build_response("I can list upcoming events soon. (Calendar querying comes next.)")
    when 'digest'
      build_response("I can send daily/weekly digests soon. (Calendar querying comes next.)")
    when 'help'
      build_response("Send event details and I’ll add it to your calendar.")
    else
      if @text.strip.empty?
        build_response("Send event details and I’ll add it to your calendar.")
      else
        extract_from_text
      end
    end
  end

  private

  def extract_from_text
    result = gemini.extract_event_from_text(@text)
    log_ai_request(@message, result[:usage], request_kind: 'text', model: gemini_extract_model, status: result[:event]['error'] ? 'error' : 'success')
    handle_event_creation(result[:event])
  rescue StandardError => e
    log_ai_request(@message, {}, request_kind: 'text', model: gemini_extract_model, status: 'error', error_message: e.message)
    build_response("Text extraction error: #{e.message}")
  end

  def handle_event_creation(event)
    if event['error']
      log_action(@message, calendar_event_id: nil, calendar_id: 'primary', status: 'error', metadata: { error: event['message'] })
      return build_response(render_extraction_result(event))
    end
    return build_response("Please connect your calendar at https://finances.sifxtre.me first.") if @user.google_refresh_token.to_s.empty?

    calendar = GoogleCalendarClient.new(@user)
    attendees = (spouse_emails(@user) + [@user.email]).uniq
    result = calendar.create_event(event, attendees: attendees, guests_can_modify: true)

    calendar_event = CalendarEvent.create!(
      user: @user,
      calendar_id: 'primary',
      event_id: result.id,
      title: result.summary,
      description: result.description,
      location: result.location,
      start_at: result.start&.date_time,
      end_at: result.end&.date_time,
      attendees: attendees.map { |email| { email: email } },
      raw_event: result.to_h,
      source: 'web'
    )

    log_action(@message, calendar_event_id: calendar_event.id, calendar_id: calendar_event.calendar_id, status: 'success')

    build_response([
      "Added to your calendar! ✅",
      "Title: #{result.summary}",
      "Date: #{event_date(result)}",
      "Time: #{event_time(result)}",
      "Link: #{result.html_link}"
    ].compact.join("\n"), event_created: true)
  rescue GoogleCalendarClient::CalendarError => e
    log_action(@message, calendar_event_id: nil, calendar_id: 'primary', status: 'error', metadata: { error: e.message })
    build_response("Calendar error: #{e.message}")
  end

  def render_extraction_result(event)
    if event['error']
      event['message'] || "I couldn't find event details in that message."
    else
      [
        "I found an event:",
        format_event(event),
        "Reply with any changes."
      ].compact.join("\n\n")
    end
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

  def classify_intent
    result = gemini.classify_intent(text: @text, has_image: false)
    log_ai_request(@message, result[:usage], request_kind: 'intent', model: gemini_intent_model, status: result[:event]['error'] ? 'error' : 'success')
    result[:event]
  rescue StandardError => e
    log_ai_request(@message, {}, request_kind: 'intent', model: gemini_intent_model, status: 'error', error_message: e.message)
    { 'intent' => 'create_event' }
  end

  def log_ai_request(message, usage, request_kind:, model:, status:, error_message: nil)
    AiRequest.create!(
      chat_message: message,
      transport: 'web',
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

  def gemini
    @gemini ||= GeminiVision.new
  end

  def spouse_emails(user)
    User.where(active: true).where.not(id: user.id).pluck(:email)
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

  def log_action(message, calendar_event_id:, calendar_id:, status:, metadata: {})
    ChatAction.create!(
      chat_message: message,
      calendar_event_id: calendar_event_id,
      calendar_id: calendar_id,
      transport: 'web',
      action_type: 'create_calendar_event',
      status: status,
      metadata: metadata
    )
  end

  def build_response(text, event_created: false)
    { text: text, event_created: event_created }
  end
end
