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
      { text: extraction_prompt(today: Time.zone.today) }
    ]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response, adjust_event_date: true)
  end

  def extract_event_from_text(text)
    parts = [{ text: text_prompt(text) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response, adjust_event_date: true)
  end

  def classify_intent(text:, has_image:)
    parts = [{ text: intent_prompt(text, has_image: has_image, today: Time.zone.today) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def extract_transaction_from_text(text)
    parts = [{ text: transaction_text_prompt(text) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def extract_transaction_from_image(image_base64, mime_type: 'image/png')
    parts = [
      { inlineData: { mimeType: mime_type, data: image_base64 } },
      { text: transaction_image_prompt(today: Time.zone.today) }
    ]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def apply_event_correction(event, correction_text)
    parts = [
      { text: event_correction_prompt(event, correction_text) }
    ]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response, adjust_event_date: true)
  end

  def apply_transaction_correction(transaction, correction_text)
    parts = [
      { text: transaction_correction_prompt(transaction, correction_text) }
    ]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def extract_event_query_from_text(text, context: nil)
    parts = [{ text: event_query_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def extract_event_update_from_text(text, context: nil)
    parts = [{ text: event_update_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def extract_recurring_scope_from_text(text, context: nil)
    parts = [{ text: recurring_scope_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def extract_memory_from_text(text)
    parts = [{ text: memory_prompt(text) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def extract_memory_query_from_text(text)
    parts = [{ text: memory_query_prompt(text) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def answer_with_memories(question, memories)
    parts = [{ text: memory_answer_prompt(question, memories) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    { text: parse_text_response(response), usage: response['usageMetadata'] || {} }
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

  def parse_json_response(response_body, adjust_event_date: false)
    text = response_body.dig('candidates', 0, 'content', 'parts', 0, 'text').to_s
    event = JSON.parse(text)
    event = adjust_event_date(event) if adjust_event_date
    { event: event, usage: response_body['usageMetadata'] || {} }
  rescue JSON::ParserError
    json_text = extract_json(text)
    event = JSON.parse(json_text)
    event = adjust_event_date(event) if adjust_event_date
    { event: event, usage: response_body['usageMetadata'] || {} }
  rescue StandardError => e
    {
      event: { 'error' => 'parse_error', 'message' => "Failed to parse Gemini response: #{e.message}" },
      usage: response_body['usageMetadata'] || {}
    }
  end

  def parse_text_response(response_body)
    response_body.dig('candidates', 0, 'content', 'parts', 0, 'text').to_s
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
      Today is #{today} (Timezone: #{timezone_label}).

      Extract calendar event details from this image. Return JSON:
      {
        "title": "Event name",
        "date": "YYYY-MM-DD" (if year missing, infer closest future date),
        "start_time": "HH:MM" (24-hour format, or null if not found),
        "end_time": "HH:MM" (24-hour format, or null if not found),
        "recurrence": {
          "frequency": "daily|weekly|monthly|yearly",
          "interval": 1,
          "by_day": ["MO", "TU"],
          "count": 10,
          "until": "YYYY-MM-DD"
        },
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
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Extract calendar event details from the text below. Return JSON:
      {
        "title": "Event name",
        "date": "YYYY-MM-DD" (if year missing, infer closest future date),
        "start_time": "HH:MM" (24-hour format, or null if not found),
        "end_time": "HH:MM" (24-hour format, or null if not found),
        "recurrence": {
          "frequency": "daily|weekly|monthly|yearly",
          "interval": 1,
          "by_day": ["MO", "TU"],
          "count": 10,
          "until": "YYYY-MM-DD"
        },
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
      Today is #{today} (Timezone: #{timezone_label}).

      You are classifying the user's intent for a chat assistant that manages calendars and finances.
      Return JSON only:
      {
        "intent": "create_event" | "update_event" | "delete_event" | "create_transaction" | "create_memory" | "search_memory" | "list_events" | "digest" | "help",
        "time_window": "today|this_week|next_week|this_month|custom|unspecified",
        "raw_time_query": "original time phrase if present",
        "confidence": "low|medium|high"
      }

      Rules:
      - If the user is sending an event (title/date/time/location) or an image, use "create_event".
      - If the user wants to change or move an existing event, use "update_event".
      - If the user wants to cancel or delete an existing event, use "delete_event".
      - If the user is describing a spend or income transaction, use "create_transaction".
      - If the user says "remember", "note", or wants to store a preference, use "create_memory".
      - If the user asks "do you remember", "what do we know", or asks a general question about preferences, use "search_memory".
      - If the user asks "what's coming up", "what's on the calendar", or similar, use "list_events".
      - If the user asks for a summary (daily/weekly), use "digest".
      - If the user asks how to use the bot, use "help".
      - If unsure, default to "create_event".

      User text:
      "#{text}"

      Has image: #{has_image}
    PROMPT
  end

  def transaction_text_prompt(text)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Extract a financial transaction from the text. Return JSON:
      {
        "amount": 12.34,
        "merchant": "Merchant name",
        "date": "YYYY-MM-DD",
        "category": "Optional category",
        "source": "Required source like #{TransactionSources.prompt_list}",
        "confidence": "low|medium|high"
      }

      If the text does not contain a transaction, return:
      {
        "error": "no_transaction_found",
        "message": "I couldn't find a transaction in that message."
      }

      Text:
      "#{text}"
    PROMPT
  end

  def transaction_image_prompt(today:)
    <<~PROMPT
      Today is #{today} (Timezone: #{timezone_label}).

      Extract a financial transaction from this image (receipt, invoice, or payment confirmation). Return JSON:
      {
        "amount": 12.34,
        "merchant": "Merchant name",
        "date": "YYYY-MM-DD",
        "category": "Optional category",
        "source": "Required source like #{TransactionSources.prompt_list}",
        "confidence": "low|medium|high"
      }

      If the image does not contain transaction information, return:
      {
        "error": "no_transaction_found",
        "message": "I couldn't find a transaction in that image."
      }
    PROMPT
  end

  def event_correction_prompt(event, correction_text)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Current event details:
      #{event.to_json}

      User correction: "#{correction_text}"

      Apply the user's correction to the event. Return JSON with the same structure and include:
      {
        "confidence": "low|medium|high"
      }
    PROMPT
  end

  def transaction_correction_prompt(transaction, correction_text)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Current transaction details:
      #{transaction.to_json}

      User correction: "#{correction_text}"

      Apply the user's correction to the transaction. Return JSON with the same structure and include:
      {
        "source": "Required source like #{TransactionSources.prompt_list}",
        "confidence": "low|medium|high"
      }
    PROMPT
  end

  def timezone_label
    'America/Los_Angeles'
  end

  def memory_prompt(text)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Extract a memory to store. Return JSON:
      {
        "content": "Normalized memory content",
        "category": "Optional category",
        "confidence": "low|medium|high"
      }

      If the text does not include a memory, return:
      {
        "error": "no_memory_found",
        "message": "I couldn't find a memory in that message."
      }

      Text:
      "#{text}"
    PROMPT
  end

  def memory_query_prompt(text)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Extract what memories to search for. Return JSON:
      {
        "query": "keywords to search",
        "confidence": "low|medium|high"
      }

      If no query is present, return:
      {
        "error": "no_memory_query",
        "message": "Missing memory search details."
      }

      Text:
      "#{text}"
    PROMPT
  end

  def memory_answer_prompt(question, memories)
    memory_lines = memories.map do |memory|
      label = memory[:category] ? "[#{memory[:category]}] " : ""
      urls = memory[:urls].is_a?(Array) && memory[:urls].any? ? " (#{memory[:urls].join(', ')})" : ""
      "- #{label}#{memory[:content]}#{urls}"
    end.join("\n")

    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      Answer the user's question using only the memories below. If the memories don't help, say you don't know.

      Question: "#{question}"

      Memories:
      #{memory_lines}
    PROMPT
  end

  def event_query_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      #{context_block}Extract the calendar event the user is referring to. Return JSON:
      {
        "title": "Event title or keywords",
        "date": "YYYY-MM-DD",
        "start_time": "HH:MM",
        "confidence": "low|medium|high"
      }

      If you cannot determine any details, return:
      {
        "error": "no_event_query",
        "message": "Missing event details."
      }

      Text:
      "#{text}"
    PROMPT
  end

  def event_update_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      #{context_block}Extract which event to update and the requested changes. Return JSON:
      {
        "confidence": "low|medium|high",
        "target": {
          "title": "Event title or keywords",
          "date": "YYYY-MM-DD",
          "start_time": "HH:MM"
        },
        "changes": {
          "title": "New title",
          "date": "YYYY-MM-DD",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "duration_minutes": 120,
          "recurrence": {
            "frequency": "daily|weekly|monthly|yearly",
            "interval": 1,
            "by_day": ["MO", "TU"],
            "count": 10,
            "until": "YYYY-MM-DD"
          },
          "recurrence_clear": true,
          "recurring_scope": "instance|series|unspecified",
          "location": "New location",
          "description": "New description"
        }
      }

      If no changes are specified, return:
      {
        "error": "no_changes",
        "message": "Missing update details."
      }

      Text:
      "#{text}"
    PROMPT
  end

  def recurring_scope_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{Time.zone.today} (Timezone: #{timezone_label}).

      #{context_block}Determine whether the user wants to change just this event or the whole recurring series. Return JSON:
      {
        "recurring_scope": "instance|series|unspecified",
        "recurrence_clear": true|false
      }

      Rules:
      - "this", "just this", "only this", "this one" => instance
      - "all", "every", "whole series", "all future", "series" => series
      - If unclear, use "unspecified".
      - If the user says "not recurring", "stop repeating", "remove recurrence", set recurrence_clear to true.

      Text:
      "#{text}"
    PROMPT
  end

  def format_context_block(context)
    context_text = context.to_s.strip
    return "" if context_text.empty?

    "Recent conversation context:\n#{context_text}\n\n"
  end

end
