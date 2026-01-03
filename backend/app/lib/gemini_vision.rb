require 'json'
require 'net/http'

class GeminiVision
  API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
  DEFAULT_EXTRACT_MODEL = ENV.fetch('GEMINI_EXTRACT_MODEL', 'gemini-3-flash-preview')
  DEFAULT_INTENT_MODEL = ENV.fetch('GEMINI_INTENT_MODEL', 'gemini-2.0-flash')

  def initialize(api_key: ENV['GEMINI_API_KEY'])
    @api_key = api_key
  end

  def extract_event_from_image(image_base64, mime_type: 'image/png')
    parts = [
      { inlineData: { mimeType: mime_type, data: image_base64 } },
      { text: extraction_prompt(today: Date.current) }
    ]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def extract_event_from_text(text)
    parts = [{ text: text_prompt(text) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def classify_intent(text:, has_image:)
    parts = [{ text: intent_prompt(text, has_image: has_image, today: Date.current) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  private

  def make_request(parts:, model:)
    raise "Missing GEMINI_API_KEY" if @api_key.to_s.strip.empty?

    uri = URI("#{API_BASE_URL}/#{model}:generateContent?key=#{@api_key}")
    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request.body = {
      contents: [{ parts: parts }],
      generationConfig: { temperature: 0.2 }
    }.to_json

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      raise "Gemini request failed: #{response.code}"
    end

    JSON.parse(response.body)
  end

  def parse_json_response(response_body)
    text = response_body.dig('candidates', 0, 'content', 'parts', 0, 'text').to_s
    event = JSON.parse(text)
    event = adjust_event_date(event)
    { event: event, usage: response_body['usageMetadata'] || {} }
  rescue JSON::ParserError
    json_text = extract_json(text)
    event = JSON.parse(json_text)
    event = adjust_event_date(event)
    { event: event, usage: response_body['usageMetadata'] || {} }
  rescue StandardError => e
    {
      event: { 'error' => 'parse_error', 'message' => "Failed to parse Gemini response: #{e.message}" },
      usage: response_body['usageMetadata'] || {}
    }
  end

  def adjust_event_date(event)
    return event unless event.is_a?(Hash)
    return event if event['date'].to_s.empty?

    date = Date.parse(event['date'])
    today = Date.current
    return event if date >= today && date <= today + 365

    adjusted = Date.new(today.year, date.month, date.day) rescue nil
    return event unless adjusted

    if adjusted < today
      adjusted = Date.new(today.year + 1, date.month, date.day) rescue nil
    end

    if adjusted && adjusted <= today + 365
      event = event.dup
      event['date'] = adjusted.iso8601
    end

    event
  rescue ArgumentError
    event
  end

  def extract_json(text)
    start_idx = text.index('{')
    end_idx = text.rindex('}')
    return '{}' unless start_idx && end_idx

    text[start_idx..end_idx]
  end

  def extraction_prompt(today:)
    <<~PROMPT
      Today is #{today}.

      Extract calendar event details from this image. Return JSON:
      {
        "title": "Event name",
        "date": "YYYY-MM-DD" (if year missing, infer closest future date),
        "start_time": "HH:MM" (24-hour format, or null if not found),
        "end_time": "HH:MM" (24-hour format, or null if not found),
        "location": "Venue name and/or address, or null if not found",
        "description": "Any additional relevant details",
        "confidence": "high" if date and time are clearly visible, "medium" if some guessing required, "low" if very uncertain
      }

      If this image does not contain event information, return:
      {
        "error": "no_event_found",
        "message": "I couldn't find event details in this image. Try sending a clearer image of an event flyer, invitation, or text message."
      }
    PROMPT
  end

  def text_prompt(text)
    <<~PROMPT
      Today is #{Date.current}.

      Extract calendar event details from the text below. Return JSON:
      {
        "title": "Event name",
        "date": "YYYY-MM-DD" (if year missing, infer closest future date),
        "start_time": "HH:MM" (24-hour format, or null if not found),
        "end_time": "HH:MM" (24-hour format, or null if not found),
        "location": "Venue name and/or address, or null if not found",
        "description": "Any additional relevant details",
        "confidence": "high" if date and time are clearly visible, "medium" if some guessing required, "low" if very uncertain
      }

      If the text does not contain event information, return:
      {
        "error": "no_event_found",
        "message": "I couldn't find event details in that message. Try including a title, date, and time."
      }

      Text:
      "#{text}"
    PROMPT
  end

  def intent_prompt(text, has_image:, today:)
    <<~PROMPT
      Today is #{today}.

      You are classifying the user's intent for a Slack assistant that manages calendar events.
      Return JSON only:
      {
        "intent": "create_event" | "list_events" | "digest" | "help",
        "time_window": "today|this_week|next_week|this_month|custom|unspecified",
        "raw_time_query": "original time phrase if present"
      }

      Rules:
      - If the user is sending an event (title/date/time/location) or an image, use "create_event".
      - If the user asks "what's coming up", "what's on the calendar", or similar, use "list_events".
      - If the user asks for a summary (daily/weekly), use "digest".
      - If the user asks how to use the bot, use "help".
      - If unsure, default to "create_event".

      User text:
      "#{text}"

      Has image: #{has_image}
    PROMPT
  end
end
