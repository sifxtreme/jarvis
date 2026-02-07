require 'json'
require 'net/http'

class GeminiClient
  API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
  DEFAULT_EXTRACT_MODEL = ENV.fetch('GEMINI_EXTRACT_MODEL', 'gemini-3-flash-preview')
  DEFAULT_INTENT_MODEL = ENV.fetch('GEMINI_INTENT_MODEL', 'gemini-2.0-flash')

  def initialize(api_key: ENV['GEMINI_API_KEY'])
    @api_key = api_key
  end

  def extract_event_from_image(image_base64, mime_type: 'image/png', context: nil)
    parts = [
      { inlineData: { mimeType: mime_type, data: image_base64 } },
      { text: extraction_prompt(today: today_in_timezone, context: context) }
    ]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response, adjust_event_date: true)
  end

  def extract_event_from_text(text, context: nil)
    parts = [{ text: text_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response, adjust_event_date: true)
  end

  def classify_intent(text:, has_image:, context: nil, image_base64: nil, mime_type: 'image/png')
    parts = []
    if image_base64
      parts << { inlineData: { mimeType: mime_type, data: image_base64 } }
    end
    parts << { text: intent_prompt(text, has_image: has_image, today: today_in_timezone, context: context) }

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def classify_image_intent(image_base64, mime_type: 'image/png', text: '', context: nil)
    parts = [
      { inlineData: { mimeType: mime_type, data: image_base64 } },
      { text: image_intent_prompt(text: text, context: context) }
    ]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def decide_pending_action(pending_action:, pending_payload:, text:, has_image:, context: nil)
    parts = [
      {
        text: pending_action_prompt(
          pending_action: pending_action,
          pending_payload: pending_payload,
          text: text,
          has_image: has_image,
          context: context
        )
      }
    ]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def extract_transaction_from_text(text, context: nil)
    parts = [{ text: transaction_text_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
    parse_json_response(response)
  end

  def extract_transaction_from_image(image_base64, mime_type: 'image/png', context: nil)
    parts = [
      { inlineData: { mimeType: mime_type, data: image_base64 } },
      { text: transaction_image_prompt(today: today_in_timezone, context: context) }
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

  def extract_transaction_query_from_text(text, context: nil)
    parts = [{ text: transaction_query_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def extract_recurring_scope_from_text(text, context: nil)
    parts = [{ text: recurring_scope_prompt(text, context: context) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    parse_json_response(response)
  end

  def clarify_missing_details(intent:, missing_fields:, extracted: {}, context: nil, extra: nil)
    parts = [{ text: clarify_missing_details_prompt(intent: intent, missing_fields: missing_fields, extracted: extracted, context: context, extra: extra) }]

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
    { text: parse_text_response(response), usage: response['usageMetadata'] || {} }
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

  def generate_intent_clarification(text:, has_image:, context: nil, image_base64: nil, mime_type: 'image/png', is_followup: false)
    parts = []
    if image_base64
      parts << { inlineData: { mimeType: mime_type, data: image_base64 } }
    end
    parts << { text: intent_clarification_prompt(text, has_image: has_image, context: context, is_followup: is_followup) }

    response = make_request(parts: parts, model: DEFAULT_INTENT_MODEL)
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
    payload = parse_json_payload(text)
    payload = normalize_extracted_payload(payload, adjust_event_date: adjust_event_date)
    { event: payload, usage: response_body['usageMetadata'] || {} }
  rescue JSON::ParserError
    json_text = extract_json(text)
    payload = JSON.parse(json_text)
    payload = normalize_extracted_payload(payload, adjust_event_date: adjust_event_date)
    { event: payload, usage: response_body['usageMetadata'] || {} }
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

  def normalize_extracted_payload(payload, adjust_event_date: false)
    if payload.is_a?(Array)
      return payload.map { |event| adjust_event_date ? adjust_event_date(event) : event }
    end

    if payload.is_a?(Hash) && payload['events'].is_a?(Array)
      events = payload['events'].map { |event| adjust_event_date ? adjust_event_date(event) : event }
      return payload.merge('events' => events)
    end

    adjust_event_date ? adjust_event_date(payload) : payload
  end

  def parse_json_payload(text)
    cleaned = clean_json_text(text)
    JSON.parse(cleaned)
  rescue JSON::ParserError
    JSON.parse(extract_json(cleaned))
  end

  def clean_json_text(text)
    cleaned = text.to_s.strip
    cleaned = cleaned.gsub(/\A```(?:json)?\s*/i, '')
    cleaned = cleaned.gsub(/```\s*\z/, '')
    cleaned
  end

  def extract_json(text)
    cleaned = text.to_s
    start_idx = cleaned.index('{') || cleaned.index('[')
    end_obj = cleaned.rindex('}')
    end_arr = cleaned.rindex(']')
    end_idx = [end_obj, end_arr].compact.max
    return '{}' unless start_idx && end_idx

    cleaned[start_idx..end_idx]
  end

  def extraction_prompt(today:, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today} (Timezone: #{timezone_label}).

      #{context_block}Extract calendar event details from this image. Return JSON:
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

      If this image includes multiple events, return:
      {
        "events": [<event objects with the same schema>]
      }

      If this image does not contain event information, return:
      {
        "error": "no_event_found",
        "message": "What’s the title, date, and time? (You can say “all‑day”.)"
      }
    PROMPT
  end

  def text_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}Extract calendar event details from the text below. Return JSON:
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

      If the text includes multiple events, return:
      {
        "events": [<event objects with the same schema>]
      }

      If the text does not contain event information, return:
      {
        "error": "no_event_found",
        "message": "What’s the title, date, and time? (You can say “all‑day”.)"
      }

      Text:
      "#{text}"
    PROMPT
  end

  def intent_prompt(text, has_image:, today:, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today} (Timezone: #{timezone_label}).

      #{context_block}You are classifying the user's intent for a chat assistant that manages calendars and finances.
      Return JSON only:
      {
        "intent": "create_event" | "update_event" | "delete_event" | "create_transaction" | "search_transaction" | "create_memory" | "search_memory" | "list_events" | "digest" | "help",
        "time_window": "today|this_week|next_week|this_month|custom|unspecified",
        "raw_time_query": "original time phrase if present",
        "confidence": "low|medium|high"
      }

      Rules:
      - If the text explicitly says to add/create/log a transaction, receipt, payment, charge, expense, or spend, ALWAYS use "create_transaction" even if an image is attached.
      - Use "create_memory" only when the user wants to remember/save/note something and there is no explicit transaction request.
      - If the user is sending an event (title/date/time/location), use "create_event".
      - If the image is a receipt, statement, or payment screenshot, use "create_transaction".
      - If the image is a note/photo to remember, use "create_memory".
      - If the user wants to change or move an existing event, use "update_event". Only use this when the user is directly requesting a change (e.g., "move my dentist to Friday", "change the meeting to 3pm"). Do NOT use "update_event" for forwarded notifications or automated messages about rescheduled appointments — those are new event info and should use "create_event".
      - If the user wants to cancel or delete an existing event, use "delete_event".
      - If the user is describing a spend or income transaction, use "create_transaction".
      - If the user wants to know about past spending, transactions, costs, or "how much did I spend", use "search_transaction".
      - If the user says "remember", "note", or wants to store a preference, use "create_memory".
      - If the user asks "do you remember", "what do we know", or asks a general question about preferences, use "search_memory".
      - NEVER use "search_memory" for questions about spending, costs, prices, or transactions. Use "search_transaction" instead.
      - If the user asks "when was the last time" or "last time" about a service, activity, or purchase (e.g. haircuts, oil change, groceries, dining, dentist), use "search_transaction" — these are things you pay for.
      - If the user asks "what's coming up", "what's on the calendar", or similar, use "list_events".
      - If the user asks for a summary (daily/weekly), use "digest".
      - If the user asks how to use the bot, use "help".
      - If unsure, default to "create_event".

      Examples:
      Text: "add this transaction - it's my mortgage"
      Intent: "create_transaction"

      Text: "how much did I spend on groceries last week?"
      Intent: "search_transaction"

      Text: "save this receipt for taxes"
      Intent: "create_memory"

      Text: "remember this photo"
      Intent: "create_memory"

      Text: "add this event to my calendar"
      Intent: "create_event"

      Text: "when's the last time the kids got haircuts"
      Intent: "search_transaction"

      Text: "last time we went to the dentist"
      Intent: "search_transaction"

      Text: "Hi Asif, Dental Smiles has rescheduled your appointment to 2/17 at 2:00 PM PST."
      Intent: "create_event"

      Text: "move my dentist to Friday"
      Intent: "update_event"

      User text:
      "#{text}"

      Has image: #{has_image}
    PROMPT
  end

  def pending_action_prompt(pending_action:, pending_payload:, text:, has_image:, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      #{context_block}You are deciding whether the user is responding to a pending question or starting a new request.
      Return JSON only:
      {
        "decision": "continue" | "new_intent",
        "intent": "create_event" | "update_event" | "delete_event" | "create_transaction" | "create_memory" | "search_memory" | "list_events" | "digest" | "help" | null,
        "confidence": "low|medium|high",
        "reason": "short"
      }

      Rules:
      - If the user's message directly answers the pending question, choose "continue".
      - If the user's message clearly starts a different task, choose "new_intent" and set intent.
      - If unsure, choose "continue".

      Pending action: #{pending_action}
      Pending payload (summary): #{pending_payload.to_json}

      User message:
      "#{text}"

      Has image: #{has_image}
    PROMPT
  end

  def transaction_text_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}Extract a financial transaction from the text. Return JSON:
      {
        "amount": 12.34,
        "merchant": "Merchant name",
        "date": "YYYY-MM-DD",
        "category": "Optional category",
        "source": "Required source like #{TransactionSources.prompt_list}",
        "confidence": "low|medium|high"
      }

      If the text includes multiple transactions, return:
      {
        "transactions": [<transaction objects with the same schema>]
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

  def transaction_image_prompt(today:, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today} (Timezone: #{timezone_label}).

      #{context_block}Extract a financial transaction from this image (receipt, invoice, or payment confirmation). Return JSON:
      {
        "amount": 12.34,
        "merchant": "Merchant name",
        "date": "YYYY-MM-DD",
        "category": "Optional category",
        "source": "Required source like #{TransactionSources.prompt_list}",
        "confidence": "low|medium|high"
      }

      If this image includes multiple transactions, return:
      {
        "transactions": [<transaction objects with the same schema>]
      }

      If the image does not contain transaction information, return:
      {
        "error": "no_transaction_found",
        "message": "I couldn't find a transaction in that image."
      }
    PROMPT
  end

  def image_intent_prompt(text:, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}Determine whether the image is a calendar event or a financial transaction. Return JSON:
      {
        "intent": "create_event" | "create_transaction" | "ambiguous",
        "confidence": "low|medium|high",
        "reason": "short explanation"
      }

      If the text helps, use it:
      "#{text}"
    PROMPT
  end

  def intent_clarification_prompt(text, has_image:, context: nil, is_followup: false)
    context_block = format_context_block(context)
    followup_note = is_followup ? "The user has already been asked once but their response was still unclear. Be more specific in your question." : ""
    image_note = has_image ? "The user attached an image." : ""

    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}You are a helpful assistant that manages calendars, transactions, and memories.

      The user sent this message but the intent is unclear:
      "#{text}"

      #{image_note}
      #{followup_note}

      Generate a short, friendly clarification question to understand what the user wants.

      Available actions:
      - Add a calendar event (dates, appointments, meetings, reminders)
      - Update or reschedule an existing event
      - Delete/cancel an event
      - List upcoming events
      - Log a transaction/expense/payment
      - Save a memory/note

      Rules:
      - Keep the question concise (1-2 sentences max)
      - Reference specific words from the user's message to show you understood
      - If the user mentioned something specific (like "dentist" or a dollar amount), use that in your question
      - Offer 2-3 relevant options based on what they said
      - Don't be robotic - sound natural and helpful

      Return ONLY the clarification question text, nothing else.
    PROMPT
  end

  def event_correction_prompt(event, correction_text)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

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
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

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

  def today_in_timezone
    Time.now.in_time_zone(timezone_label).to_date
  end

  def memory_prompt(text)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

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
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

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
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      Answer the user's question using only the memories below. If the memories don't help, say you don't know.

      Question: "#{question}"

      Memories:
      #{memory_lines}
    PROMPT
  end

  def transaction_query_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}Extract the transaction search criteria from the user's message. Return JSON:
      {
        "merchant": "Merchant name or keywords",
        "category": "Category name or keywords",
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD",
        "min_amount": 10.00,
        "max_amount": 100.00,
        "limit": 10,
        "confidence": "low|medium|high"
      }

      Rules:
      - If user says "last week", set start/end date accordingly.
      - If user says "this month", set start/end date accordingly.
      - If user asks "how much did I spend", looking for a sum, extract the criteria to filter by.
      - If user asks for "transactions from Amazon", set merchant to "Amazon".
      - If the user mentions a service, activity, or product (e.g. "haircuts", "oil change", "groceries"), use it as the merchant field for keyword matching.
      - NEVER return an error if there are any usable keywords in the query. Always attempt a best-effort extraction.

      If you cannot determine any details, return:
      {
        "error": "no_transaction_query",
        "message": "Missing search details."
      }

      Examples:
      Text: "when the kids got haircuts" → {"merchant": "haircut", "confidence": "medium"}
      Text: "last oil change" → {"merchant": "oil change", "confidence": "medium"}

      Text:
      "#{text}"
    PROMPT
  end

  def event_query_prompt(text, context: nil)
    context_block = format_context_block(context)
    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}Extract the calendar event query from the user's message. Return JSON:
      {
        "title": "Event title or keywords (empty if not searching by title)",
        "date": "YYYY-MM-DD (empty if not searching by date)",
        "start_time": "HH:MM (empty if not specified)",
        "raw_time_query": "original time phrase from user",
        "query_type": "date_only|title_search|combined|general",
        "confidence": "low|medium|high"
      }

      Query types:
      - "date_only": User asking about a specific date/time without a title (e.g., "what am I doing tomorrow?", "what's on my calendar Friday?")
      - "title_search": User searching for a specific event by name (e.g., "when is my dentist appointment?", "do I have any meetings?")
      - "combined": Both date and title specified (e.g., "do I have a dentist appointment tomorrow?")
      - "general": General schedule query with no specifics (e.g., "what's next?", "what's coming up?")

      Rules:
      - If the user says "today", "tonight", "this morning", "this afternoon", or "this evening", set "date" to today.
      - If the user says "tomorrow", set "date" to tomorrow.
      - If the user gives only a weekday ("Friday"), choose the next occurrence of that weekday.
      - "raw_time_query" should contain the user's original time phrase (e.g., "tomorrow", "this Friday", "today", "next week"). If the user didn't mention a time, leave it empty.
      - For "date_only" queries, leave "title" empty - do NOT extract keywords like "doing" or "scheduled".

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
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

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
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

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

  def clarify_missing_details_prompt(intent:, missing_fields:, extracted:, context: nil, extra: nil)
    context_block = format_context_block(context)
    missing_list = Array(missing_fields).map(&:to_s).join(', ')
    extracted_json = extracted.to_json
    extra_block = extra.to_s.strip
    extra_block = extra_block.empty? ? "" : "Extra context:\n#{extra_block}\n\n"

    <<~PROMPT
      Today is #{today_in_timezone} (Timezone: #{timezone_label}).

      #{context_block}You are helping a user complete a #{intent} request. Ask one concise question to get the missing details.
      Missing fields: #{missing_list}
      Known details: #{extracted_json}
      #{extra_block}Return only the question text. Do not include JSON.
    PROMPT
  end

end
