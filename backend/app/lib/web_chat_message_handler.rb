require 'base64'
require 'digest'
require 'image_processing/mini_magick'
require 'securerandom'
require 'stringio'

class WebChatMessageHandler
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

    if image_attached? && @text.strip.empty?
      return ask_image_intent
    end

    intent = classify_intent
    intent_name = intent['intent'] || 'create_event'
    intent_confidence = normalize_confidence(intent['confidence'])

    if intent_confidence == 'low'
      return ask_intent_clarification
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

  def pending_action?
    thread_state['pending_action'].present?
  end

  def thread_state
    @thread.state ||= {}
  end

  def update_thread_state(next_state)
    @thread.update!(state: next_state)
  end

  def merge_thread_state(patch)
    update_thread_state(thread_state.merge(patch))
  end

  def clear_thread_state
    update_thread_state(thread_state.slice('last_event_id'))
  end

  def set_pending_action(action, payload = {})
    merge_thread_state('pending_action' => action, 'payload' => payload)
  end

  def remember_last_event(event_id)
    merge_thread_state('last_event_id' => event_id)
  end

  def last_event_record
    event_id = thread_state['last_event_id']
    return nil if event_id.blank?

    CalendarEvent.find_by(id: event_id)
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

  def handle_clarified_intent(payload)
    intent = resolve_intent_from_text
    image_message_id = payload['image_message_id']
    clear_thread_state

    case intent
    when 'create_transaction'
      handle_create_transaction(image_message_id: image_message_id)
    when 'create_memory'
      handle_create_memory
    when 'search_memory'
      handle_search_memory
    when 'delete_event'
      handle_delete_event
    when 'update_event'
      handle_update_event
    else
      handle_create_event(image_message_id: image_message_id)
    end
  end

  def handle_create_memory
    urls = extract_urls(@text)
    if image_attached? && @text.strip.empty?
      return create_memory({ 'content' => 'Saved image', 'category' => 'image', 'urls' => urls })
    end

    if urls.any? && strip_urls(@text).strip.empty?
      return create_memory({ 'content' => 'Saved link', 'category' => 'link', 'urls' => urls })
    end

    result = gemini.extract_memory_from_text(@text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'memory',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    data = result[:event] || {}
    data['urls'] = urls if urls.any?

    if data['error']
      return build_response(data['message'] || "I couldn't find a memory to save.")
    end

    content = data['content'].to_s.strip
    confidence = normalize_confidence(data['confidence'])
    if content.empty?
      set_pending_action('clarify_memory_fields', { 'memory' => data })
      return build_response("What should I remember?")
    end

    if confidence != 'high'
      set_pending_action('confirm_memory', { 'memory' => data })
      return build_response("Should I save this memory?\n\n#{format_memory(data)}")
    end

    create_memory(data)
  rescue StandardError => e
    build_response("Memory error: #{e.message}")
  end

  def handle_memory_correction(payload)
    result = gemini.extract_memory_from_text(@text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'memory',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    updated = result[:event] || {}

    if updated['error']
      return build_response(updated['message'] || "I couldn't update that memory.")
    end

    urls = extract_urls(@text)
    updated['urls'] = urls if urls.any?

    content = updated['content'].to_s.strip
    confidence = normalize_confidence(updated['confidence'])
    if content.empty?
      set_pending_action('clarify_memory_fields', { 'memory' => updated })
      return build_response("What should I remember?")
    end

    if confidence != 'high'
      set_pending_action('confirm_memory', { 'memory' => updated })
      return build_response("Should I save this memory?\n\n#{format_memory(updated)}")
    end

    create_memory(updated)
  rescue StandardError => e
    build_response("Memory error: #{e.message}")
  end

  def handle_memory_confirmation(payload)
    data = payload['memory'] || {}
    if affirmative?
      clear_thread_state
      return create_memory(data)
    end

    clear_thread_state
    build_response("Okay, tell me what you want to remember.")
  end

  def handle_search_memory
    result = gemini.extract_memory_query_from_text(@text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'memory_query',
      model: gemini_intent_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    query = result[:event] || {}

    if query['error'] || query['query'].to_s.strip.empty?
      return build_response("What should I search for in your memories?")
    end

    memories = search_memories(query['query'])
    return build_response("I couldn't find any memories about that.") if memories.empty?

    answer = gemini.answer_with_memories(@text, memories)
    log_ai_request(
      @message,
      answer[:usage],
      request_kind: 'memory_answer',
      model: gemini_extract_model,
      status: answer[:text].to_s.empty? ? 'error' : 'success',
      metadata: ai_metadata(response: { text: answer[:text] })
    )
    build_response(answer[:text].presence || format_memory_list(memories))
  rescue StandardError => e
    build_response("Memory search error: #{e.message}")
  end

  def handle_create_event(image_message_id: nil)
    result = if image_message_id
      extract_event_from_message(image_message_id)
    elsif image_attached?
      extract_from_image
    else
      extract_from_text
    end

    return result if result.is_a?(Hash) && result[:text]

    event = result[:event] || {}
    if event['error']
      clear_thread_state
      return build_response(event['message'] || "I couldn't find event details.")
    end
    event['recurrence'] = normalize_recurrence(event['recurrence'])
    missing = missing_event_fields(event)
    confidence = normalize_confidence(event['confidence'])

    if missing.any?
      set_pending_action('clarify_event_fields', { 'event' => event, 'missing_fields' => missing })
      return build_response("I need #{missing.join(', ')} to add this event.")
    end

    if confidence != 'high'
      set_pending_action('confirm_event', { 'event' => event })
      return build_response("I found this event:\n\n#{format_event(event)}\n\nShould I add it?")
    end

    create_event(event)
  end

  def handle_event_correction(payload)
    event = payload['event'] || {}
    result = gemini.apply_event_correction(event, @text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'event_correction',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )

    updated = result[:event]
    if updated['error']
      clear_thread_state
      return build_response(updated['message'] || "I couldn't update the transaction.")
    end
    if updated['error']
      clear_thread_state
      return build_response(updated['message'] || "I couldn't update the event details.")
    end
    missing = missing_event_fields(updated)
    confidence = normalize_confidence(updated['confidence'])
    updated['recurrence'] = normalize_recurrence(updated['recurrence'])

    if missing.any?
      set_pending_action('clarify_event_fields', { 'event' => updated, 'missing_fields' => missing })
      return build_response("I still need #{missing.join(', ')}.")
    end

    if confidence != 'high'
      set_pending_action('confirm_event', { 'event' => updated })
      return build_response("Got it. Here’s the event:\n\n#{format_event(updated)}\n\nShould I add it?")
    end

    create_event(updated)
  rescue StandardError => e
    clear_thread_state
    build_response("Event correction error: #{e.message}")
  end

  def handle_event_confirmation(payload)
    event = payload['event'] || {}
    if affirmative?
      clear_thread_state
      return create_event(event)
    end

    clear_thread_state
    build_response("Okay, what should I change?")
  end

  def handle_update_event
    result = gemini.extract_event_update_from_text(@text, context: recent_context_text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'event_update',
      model: gemini_intent_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    data = result[:event] || {}

    changes = (data['changes'] || {}).compact
    changes['confidence'] = data['confidence'] if data['confidence']
    duration_minutes = parse_duration_minutes(@text)
    changes['duration_minutes'] = duration_minutes if duration_minutes
    changes['recurrence'] = normalize_recurrence(changes['recurrence'])
    changes['recurrence_clear'] = true if changes['recurrence_clear']
    if changes.empty?
      set_pending_action('clarify_update_changes', { 'target' => (data['target'] || {}).compact })
      return build_response("What should I change about the event?")
    end

    target = (data['target'] || {}).compact
    if target.empty?
      if (recent_event = last_event_record)
        return confirm_or_update_event(recent_event, changes)
      end
      set_pending_action('clarify_update_target', { 'changes' => changes })
      return build_response("Which event should I update? Please share the title and date.")
    end

    candidates = find_event_candidates_with_fallback(target)
    if candidates.empty?
      set_pending_action('clarify_update_target', { 'changes' => changes })
      return build_response("I couldn't find that event. Can you share the title and date?")
    end

    if candidates.length > 1
      set_pending_action('select_event_for_update', { 'candidates' => serialize_candidates(candidates), 'changes' => changes })
      return build_response("Which event should I update?\n#{format_candidates(candidates)}")
    end

    event_record = candidates.first[:event]
    confirm_or_update_event(event_record, changes)
  rescue StandardError => e
    build_response("Update error: #{e.message}")
  end

  def handle_update_target_clarification(payload)
    changes = payload['changes'] || {}
    query = gemini.extract_event_query_from_text(@text, context: recent_context_text)
    log_ai_request(
      @message,
      query[:usage],
      request_kind: 'event_query',
      model: gemini_intent_model,
      status: query[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: query[:event])
    )
    data = query[:event]

    if data['error']
      if (recent_event = last_event_record)
        clear_thread_state
        return confirm_or_update_event(recent_event, changes)
      end
      return build_response("I still need the event title or date.")
    end

    candidates = find_event_candidates_with_fallback(data)
    if candidates.empty?
      set_pending_action('clarify_update_target', { 'changes' => changes })
      return build_response("I couldn't find that event. Can you share the title and date?")
    end

    if candidates.length > 1
      set_pending_action('select_event_for_update', { 'candidates' => serialize_candidates(candidates), 'changes' => changes })
      return build_response("Which event should I update?\n#{format_candidates(candidates)}")
    end

    clear_thread_state
    confirm_or_update_event(candidates.first[:event], changes)
  rescue StandardError => e
    build_response("Update error: #{e.message}")
  end

  def handle_update_changes_clarification(payload)
    target = (payload['target'] || {}).compact
    result = gemini.extract_event_update_from_text(@text, context: recent_context_text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'event_update',
      model: gemini_intent_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    data = result[:event] || {}

    changes = (data['changes'] || {}).compact
    changes['confidence'] = data['confidence'] if data['confidence']
    duration_minutes = parse_duration_minutes(@text)
    changes['duration_minutes'] = duration_minutes if duration_minutes
    changes['recurrence'] = normalize_recurrence(changes['recurrence'])
    changes['recurrence_clear'] = true if changes['recurrence_clear']

    if changes.empty?
      return build_response("I still need what to change (time, date, title, etc.).")
    end

    target = (data['target'] || {}).compact if target.empty?
    if target.empty?
      if (recent_event = last_event_record)
        clear_thread_state
        return confirm_or_update_event(recent_event, changes)
      end
      set_pending_action('clarify_update_target', { 'changes' => changes })
      return build_response("Which event should I update? Please share the title and date.")
    end

    candidates = find_event_candidates(target)
    if candidates.empty?
      set_pending_action('clarify_update_target', { 'changes' => changes })
      return build_response("I couldn't find that event. Can you share the title and date?")
    end

    if candidates.length > 1
      set_pending_action('select_event_for_update', { 'candidates' => serialize_candidates(candidates), 'changes' => changes })
      return build_response("Which event should I update?\n#{format_candidates(candidates)}")
    end

    clear_thread_state
    confirm_or_update_event(candidates.first[:event], changes)
  rescue StandardError => e
    build_response("Update error: #{e.message}")
  end

  def handle_update_confirmation(payload)
    event_id = payload['event_id']
    changes = payload['changes'] || {}
    snapshot = payload['snapshot']
    event_record = CalendarEvent.find_by(id: event_id)
    unless event_record
      calendar_id = snapshot.is_a?(Hash) ? (snapshot['calendar_id'] || snapshot[:calendar_id]) : nil
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: calendar_id,
        status: 'error',
        action_type: 'update_calendar_event',
        metadata: { error_code: 'event_not_found', event_id: event_id, snapshot: snapshot, correlation_id: @correlation_id }
      )
      return build_response("I couldn't find that event anymore.", error_code: 'event_not_found')
    end

    if affirmative?
      clear_thread_state
      updated_changes = changes.dup
      updated_changes['recurrence'] = normalize_recurrence(updated_changes['recurrence'])

      directive = resolve_recurring_scope(@text)
      updated_changes['recurrence_clear'] = true if updated_changes['recurrence_clear'] || directive[:recurrence_clear]

      scope = updated_changes['recurring_scope'] || directive[:scope]
      if recurring_event?(event_record) && scope.nil?
        set_pending_action(
          'clarify_recurring_scope',
          { 'event_id' => event_record.id, 'changes' => updated_changes, 'snapshot' => snapshot, 'action' => 'update' }
        )
        return build_response("This event repeats. Update just this event or the whole series? Reply \"this\" or \"all\".")
      end
      if scope == 'instance' && (updated_changes['recurrence'] || updated_changes['recurrence_clear'])
        set_pending_action(
          'clarify_recurring_scope',
          { 'event_id' => event_record.id, 'changes' => updated_changes, 'snapshot' => snapshot, 'action' => 'update' }
        )
        return build_response("Recurrence changes apply to the whole series. Update the series instead? Reply \"all\" or \"this\" to pick.")
      end
      updated_changes['recurring_scope'] = scope if scope

      return apply_event_update(event_record, updated_changes, snapshot: snapshot)
    end

    clear_thread_state
    build_response("Okay, let me know what you want updated.")
  end

  def confirm_or_update_event(event_record, changes)
    confidence = normalize_confidence(changes['confidence'])
    scope = changes['recurring_scope'] || resolve_recurring_scope(@text)[:scope]
    if recurring_event?(event_record) && scope.nil?
      set_pending_action(
        'clarify_recurring_scope',
        { 'event_id' => event_record.id, 'changes' => changes, 'snapshot' => event_snapshot(event_record), 'action' => 'update' }
      )
      return build_response("This event repeats. Update just this event or the whole series? Reply \"this\" or \"all\".")
    end
    if scope == 'instance' && (changes['recurrence'] || changes['recurrence_clear'])
      set_pending_action(
        'clarify_recurring_scope',
        { 'event_id' => event_record.id, 'changes' => changes, 'snapshot' => event_snapshot(event_record), 'action' => 'update' }
      )
      return build_response("Recurrence changes apply to the whole series. Update the series instead? Reply \"all\" or \"this\" to pick.")
    end
    changes['recurring_scope'] = scope if scope
    snapshot = event_snapshot(event_record)
    if confidence != 'high'
      set_pending_action('confirm_update', { 'event_id' => event_record.id, 'changes' => changes, 'snapshot' => snapshot })
      return build_response("I plan to update:\n#{format_event_changes(event_record, changes)}\n\nShould I apply this?")
    end

    apply_event_update(event_record, changes, snapshot: snapshot)
  end

  def handle_delete_event
    query = gemini.extract_event_query_from_text(@text, context: recent_context_text)
    log_ai_request(
      @message,
      query[:usage],
      request_kind: 'event_query',
      model: gemini_intent_model,
      status: query[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: query[:event])
    )
    data = query[:event]

    if data['error']
      return build_response("Which event should I delete? Please share the title and date.")
    end

    candidates = find_event_candidates_with_fallback(data)
    if candidates.empty?
      set_pending_action('clarify_delete_target')
      return build_response("I couldn't find that event. Can you share the title and date?")
    end

    if candidates.length > 1
      set_pending_action('select_event_for_delete', { 'candidates' => serialize_candidates(candidates) })
      return build_response("Which event should I delete?\n#{format_candidates(candidates)}")
    end

    confirm_or_delete_event(candidates.first[:event])
  rescue StandardError => e
    build_response("Delete error: #{e.message}")
  end

  def handle_list_events
    query = gemini.extract_event_query_from_text(@text, context: recent_context_text)
    log_ai_request(
      @message,
      query[:usage],
      request_kind: 'event_query',
      model: gemini_intent_model,
      status: query[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: query[:event])
    )
    data = query[:event] || {}

    title = data['title'].to_s.strip
    date = data['date'].to_s.strip
    title = fallback_list_title(title)
    scope = CalendarEvent.where(user: @user).where.not(status: 'cancelled')
    start_at = Time.zone.now
    end_at = start_at + CALENDAR_WINDOW_FUTURE_DAYS.days
    scope = scope.where(start_at: start_at..end_at)

    if date.present?
      day = Date.parse(date) rescue nil
      scope = scope.where(start_at: day.beginning_of_day..day.end_of_day) if day
    end

    if title.present?
      scope = apply_title_filters(scope, title)
    end

    events = scope.order(:start_at).limit(5).to_a
    if events.empty? && title.present?
      events = fuzzy_event_candidates(title).map { |entry| entry[:event] }
    end

    if events.empty?
      set_pending_action('clarify_list_query', { 'query' => data })
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: nil,
        status: 'success',
        action_type: 'list_events',
        metadata: { query: data, result_count: 0 }
      )
      return build_response("I couldn't find any upcoming events that match. Want me to search a different title?")
    end

    lines = events.map { |event| format_event_brief(event) }
    response = title.present? ? "Here are the next matches:\n#{lines.join("\n")}" : "Here are the next events:\n#{lines.join("\n")}"
    log_action(
      @message,
      calendar_event_id: nil,
      calendar_id: nil,
      status: 'success',
      action_type: 'list_events',
      metadata: { query: data, result_count: events.length }
    )
    build_response(response)
  rescue StandardError => e
    build_response("List error: #{e.message}")
  end

  def handle_list_query_clarification(payload)
    data = payload['query'] || {}
    title = data['title'].to_s.strip
    title = fallback_list_title(title)
    title = fallback_list_title(@text) if title.empty?

    scope = CalendarEvent.where(user: @user).where.not(status: 'cancelled')
    scope = scope.where(start_at: Time.zone.now..(Time.zone.now + CALENDAR_WINDOW_FUTURE_DAYS.days))
    scope = apply_title_filters(scope, title) if title.present?

    events = scope.order(:start_at).limit(5).to_a
    events = fuzzy_event_candidates(title).map { |entry| entry[:event] } if events.empty? && title.present?

    if events.empty?
      return build_response("Still nothing. Try a specific title or date.")
    end

    clear_thread_state
    lines = events.map { |event| format_event_brief(event) }
    build_response("Here are the next matches:\n#{lines.join("\n")}")
  rescue StandardError => e
    build_response("List error: #{e.message}")
  end

  def handle_delete_target_clarification(_payload)
    query = gemini.extract_event_query_from_text(@text, context: recent_context_text)
    log_ai_request(
      @message,
      query[:usage],
      request_kind: 'event_query',
      model: gemini_intent_model,
      status: query[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: query[:event])
    )
    data = query[:event]

    if data['error']
      return build_response("I still need the event title or date.")
    end

    candidates = find_event_candidates_with_fallback(data)
    return build_response("I couldn't find that event. Can you share the title and date?") if candidates.empty?

    if candidates.length > 1
      set_pending_action('select_event_for_delete', { 'candidates' => serialize_candidates(candidates) })
      return build_response("Which event should I delete?\n#{format_candidates(candidates)}")
    end

    clear_thread_state
    confirm_or_delete_event(candidates.first[:event])
  rescue StandardError => e
    build_response("Delete error: #{e.message}")
  end

  def handle_event_selection(payload, action_type:)
    candidates = (payload['candidates'] || []).map { |entry| symbolize_candidate(entry) }.compact
    selected = pick_candidate(candidates)

    unless selected
      return build_response("Reply with the number of the event you want.")
    end

    event_record = selected[:event]
    selection_index = selection_index_from_text(candidates.length)
    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'success',
      action_type: 'select_calendar_event',
      metadata: {
        selection_kind: action_type,
        selection_index: selection_index,
        candidates: payload['candidates'],
        selected_event: event_snapshot(event_record),
        changes: payload['changes'],
        correlation_id: @correlation_id
      }.compact
    )

    clear_thread_state
    if action_type == 'delete'
      confirm_or_delete_event(event_record)
    else
      changes = payload['changes'] || {}
      confirm_or_update_event(event_record, changes)
    end
  end

  def confirm_or_delete_event(event_record)
    scope = resolve_recurring_scope(@text)[:scope]
    if recurring_event?(event_record) && scope.nil?
      set_pending_action(
        'clarify_recurring_scope',
        { 'event_id' => event_record.id, 'snapshot' => event_snapshot(event_record), 'action' => 'delete' }
      )
      return build_response("This event repeats. Delete just this event or the whole series? Reply \"this\" or \"all\".")
    end
    set_pending_action(
      'confirm_delete',
      { 'event_id' => event_record.id, 'snapshot' => event_snapshot(event_record), 'recurring_scope' => scope }
    )
    build_response("Delete this event?\n#{format_event_record(event_record)}")
  end

  def handle_delete_confirmation(payload)
    event_id = payload['event_id']
    snapshot = payload['snapshot']
    scope = payload['recurring_scope'] || resolve_recurring_scope(@text)[:scope]
    event_record = CalendarEvent.find_by(id: event_id)
    unless event_record
      calendar_id = snapshot.is_a?(Hash) ? (snapshot['calendar_id'] || snapshot[:calendar_id]) : nil
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: calendar_id,
        status: 'error',
        action_type: 'delete_calendar_event',
        metadata: { error_code: 'event_not_found', event_id: event_id, snapshot: snapshot, correlation_id: @correlation_id }
      )
      return build_response("I couldn't find that event anymore.", error_code: 'event_not_found')
    end

    if affirmative?
      clear_thread_state
      return delete_event(event_record, scope: scope)
    end

    clear_thread_state
    build_response("Okay, I won’t delete it.")
  end

  def handle_recurring_scope_clarification(payload)
    scope = resolve_recurring_scope(@text)[:scope]
    return build_response("Reply \"this\" to change only this event or \"all\" for the whole series.") unless scope

    event_record = CalendarEvent.find_by(id: payload['event_id'])
    unless event_record
      clear_thread_state
      return build_response("I couldn't find that event anymore.", error_code: 'event_not_found')
    end

    clear_thread_state
    if payload['action'] == 'delete'
      return delete_event(event_record, scope: scope)
    end

    changes = payload['changes'] || {}
    changes['recurring_scope'] = scope
    apply_event_update(event_record, changes, snapshot: payload['snapshot'])
  end

  def handle_create_transaction(image_message_id: nil)
    result = if image_message_id
      extract_transaction_from_message(image_message_id)
    elsif image_attached?
      extract_transaction_from_image
    else
      extract_transaction_from_text
    end

    return result if result.is_a?(Hash) && result[:text]

    transaction = result[:event] || {}
    if transaction['error']
      clear_thread_state
      return build_response(transaction['message'] || "I couldn't find a transaction.")
    end
    missing = missing_transaction_fields(transaction)
    confidence = normalize_confidence(transaction['confidence'])

    if missing.any?
      set_pending_action('clarify_transaction_fields', { 'transaction' => transaction, 'missing_fields' => missing })
      if missing.include?('a source') && image_attached?
        return build_response("Which source should I use? Most screenshots are `bofa` — is that correct?")
      end
      if missing.include?('a valid source')
        return build_response("Which source should I use? Options: #{TransactionSources.prompt_list}.")
      end
      return build_response("I need #{missing.join(', ')} to add this transaction.")
    end

    if confidence != 'high'
      set_pending_action('confirm_transaction', { 'transaction' => transaction })
      return build_response("I found this transaction:\n\n#{format_transaction(transaction)}\n\nShould I add it?")
    end

    create_transaction(transaction)
  end

  def handle_transaction_correction(payload)
    transaction = payload['transaction'] || {}
    result = gemini.apply_transaction_correction(transaction, @text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'transaction_correction',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )

    updated = result[:event]
    missing = missing_transaction_fields(updated)
    confidence = normalize_confidence(updated['confidence'])

    if missing.any?
      set_pending_action('clarify_transaction_fields', { 'transaction' => updated, 'missing_fields' => missing })
      if missing.include?('a source') && image_attached?
        return build_response("Which source should I use? Most screenshots are `bofa` — is that correct?")
      end
      if missing.include?('a valid source')
        return build_response("Which source should I use? Options: #{TransactionSources.prompt_list}.")
      end
      return build_response("I still need #{missing.join(', ')}.")
    end

    if confidence != 'high'
      set_pending_action('confirm_transaction', { 'transaction' => updated })
      return build_response("Got it. Here’s the transaction:\n\n#{format_transaction(updated)}\n\nShould I add it?")
    end

    create_transaction(updated)
  rescue StandardError => e
    clear_thread_state
    build_response("Transaction correction error: #{e.message}")
  end

  def handle_transaction_confirmation(payload)
    transaction = payload['transaction'] || {}
    if affirmative?
      clear_thread_state
      return create_transaction(transaction)
    end

    clear_thread_state
    build_response("Okay, what should I change?")
  end

  def extract_from_text
    result = gemini.extract_event_from_text(@text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'text',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result
  rescue StandardError => e
    log_ai_request(
      @message,
      {},
      request_kind: 'text',
      model: gemini_extract_model,
      status: 'error',
      error_message: e.message,
      metadata: ai_metadata
    )
    { text: "Text extraction error: #{e.message}" }
  end

  def extract_from_image
    image_base64, mime_type = gemini_image_payload(@image)
    result = gemini.extract_event_from_image(image_base64, mime_type: mime_type)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'image',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result
  rescue StandardError => e
    log_ai_request(
      @message,
      {},
      request_kind: 'image',
      model: gemini_extract_model,
      status: 'error',
      error_message: e.message,
      metadata: ai_metadata
    )
    { text: "Image extraction error: #{e.message}" }
  end

  def extract_event_from_message(message_id)
    message = ChatMessage.find_by(id: message_id)
    return { text: "I couldn't find that image anymore." } unless message&.image&.attached?

    image_base64, mime_type = gemini_image_payload(message.image)
    result = gemini.extract_event_from_image(image_base64, mime_type: mime_type)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'image',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result
  rescue StandardError => e
    { text: "Image extraction error: #{e.message}" }
  end

  def extract_transaction_from_text
    result = gemini.extract_transaction_from_text(@text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'transaction_text',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result
  rescue StandardError => e
    { text: "Transaction extraction error: #{e.message}" }
  end

  def extract_transaction_from_image
    image_base64, mime_type = gemini_image_payload(@image)
    result = gemini.extract_transaction_from_image(image_base64, mime_type: mime_type)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'transaction_image',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result
  rescue StandardError => e
    { text: "Transaction extraction error: #{e.message}" }
  end

  def extract_transaction_from_message(message_id)
    message = ChatMessage.find_by(id: message_id)
    return { text: "I couldn't find that image anymore." } unless message&.image&.attached?

    image_base64, mime_type = gemini_image_payload(message.image)
    result = gemini.extract_transaction_from_image(image_base64, mime_type: mime_type)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'transaction_image',
      model: gemini_extract_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result
  rescue StandardError => e
    { text: "Transaction extraction error: #{e.message}" }
  end

  def create_event(event)
    if event['error']
      log_action(@message, calendar_event_id: nil, calendar_id: primary_calendar_id, status: 'error', action_type: 'create_calendar_event', metadata: { error: event['message'] })
      return build_response(render_extraction_result(event))
    end
    if @user.google_refresh_token.to_s.empty?
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: primary_calendar_id,
        status: 'error',
        action_type: 'create_calendar_event',
        metadata: { error_code: 'insufficient_permissions', correlation_id: @correlation_id }
      )
      return build_response("Please connect your calendar at https://finances.sifxtre.me first.", error_code: 'insufficient_permissions')
    end

    calendar_id = primary_calendar_id
    calendar = GoogleCalendarClient.new(@user)
    attendees = (spouse_emails(@user) + [@user.email]).uniq
    recurrence_rules = build_recurrence_rules(event['recurrence'], start_date: event['date'])

    idempotency_payload = { event: event, attendees: attendees, calendar_id: calendar_id }
    signature = idempotency_signature('create_calendar_event', idempotency_payload)
    if duplicate_action?('create_calendar_event', signature)
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: calendar_id,
        status: 'duplicate',
        action_type: 'create_calendar_event',
        metadata: { error_code: 'duplicate_request', event: event, correlation_id: @correlation_id }
      )
      return build_response("I already added that event. ✅", action: 'calendar_event_created')
    end

    result = calendar.create_event(
      event,
      calendar_id: calendar_id,
      attendees: attendees,
      guests_can_modify: true,
      recurrence_rules: recurrence_rules
    )

    calendar_event = CalendarEvent.create!(
      user: @user,
      calendar_id: calendar_id,
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

    log_action(
      @message,
      calendar_event_id: calendar_event.id,
      calendar_id: calendar_event.calendar_id,
      status: 'success',
      action_type: 'create_calendar_event',
      metadata: {
        event_id: calendar_event.event_id,
        title: calendar_event.title,
        confidence: event['confidence'],
        calendar_request: { event: event, attendees: attendees, calendar_id: calendar_id, recurrence_rules: recurrence_rules },
        calendar_response: result.to_h,
        correlation_id: @correlation_id
      }.compact
    )
    remember_last_event(calendar_event.id)
    remember_idempotency!('create_calendar_event', signature)

    response_lines = [
      "Added to your calendar! ✅",
      "Title: #{result.summary}",
      "Date: #{event_date(result)}",
      "Time: #{event_time_range(result)}",
      "Guests: #{attendees.join(', ')}",
      "Link: #{result.html_link}"
    ]
    if recurrence_rules.present?
      response_lines << "Recurrence: #{recurrence_rules.join(', ')}"
    end
    build_response(response_lines.compact.join("\n"), event_created: true, action: 'calendar_event_created')
  rescue GoogleCalendarClient::CalendarAuthError => e
    fingerprint = token_fingerprint(@user&.google_refresh_token)
    handle_calendar_auth_expired!(
      @user,
      error: e.message,
      calendar_id: primary_calendar_id,
      source: 'web_chat_create'
    )
    log_action(
      @message,
      calendar_event_id: nil,
      calendar_id: primary_calendar_id,
      status: 'error',
      action_type: 'create_calendar_event',
      metadata: {
        error_code: 'calendar_auth_expired',
        error: e.message,
        token_fingerprint: fingerprint,
        correlation_id: @correlation_id
      }
    )
    build_response(
      "Your calendar authorization expired. Please reconnect at https://finances.sifxtre.me.",
      error_code: 'calendar_auth_expired'
    )
  rescue GoogleCalendarClient::CalendarError => e
    log_action(
      @message,
      calendar_event_id: nil,
      calendar_id: primary_calendar_id,
      status: 'error',
      action_type: 'create_calendar_event',
      metadata: { error_code: 'calendar_create_failed', error: e.message, correlation_id: @correlation_id }
    )
    build_response("Calendar error: #{e.message}", error_code: 'calendar_create_failed')
  end

  def apply_event_update(event_record, changes, snapshot: nil)
    if @user.google_refresh_token.to_s.empty?
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: 'error',
        action_type: 'update_calendar_event',
        metadata: { error_code: 'insufficient_permissions', event_id: event_record.event_id, correlation_id: @correlation_id }
      )
      return build_response("Please connect your calendar at https://finances.sifxtre.me first.", error_code: 'insufficient_permissions')
    end

    updates = build_event_updates(event_record, changes)
    if updates.nil?
      return build_response("I need a new date or time to update the event.", error_code: 'missing_event_update_fields')
    end

    scope = changes['recurring_scope'] || 'instance'
    target_event_id = scope == 'series' ? recurring_master_event_id(event_record) : event_record.event_id

    idempotency_payload = { event_id: target_event_id, changes: changes, scope: scope }
    signature = idempotency_signature('update_calendar_event', idempotency_payload)
    if duplicate_action?('update_calendar_event', signature)
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: 'duplicate',
        action_type: 'update_calendar_event',
        metadata: { error_code: 'duplicate_request', event_id: target_event_id, changes: changes, scope: scope, correlation_id: @correlation_id }
      )
      return build_response("I already applied that update. ✅", action: 'calendar_event_updated')
    end

    client = GoogleCalendarClient.new(@user)
    result = client.update_event(calendar_id: event_record.calendar_id, event_id: target_event_id, updates: updates)

    verified_event = nil
    verification = { verified: false }
    begin
      verified_event = client.get_event(calendar_id: event_record.calendar_id, event_id: target_event_id)
      verification = verify_event_updates(verified_event, updates)
    rescue GoogleCalendarClient::CalendarError => e
      verification = { verified: false, error: e.message }
    end

    detached_instance = nil
    if scope == 'instance' && updates['recurrence_clear']
      detached_instance = client.detach_instance(
        calendar_id: event_record.calendar_id,
        instance_id: target_event_id,
        event: verified_event || result
      )
    end

    event_source = detached_instance || verified_event || result
    update_payload = {
      title: event_source.summary,
      description: event_source.description,
      location: event_source.location,
      start_at: event_source.start&.date_time || event_source.start&.date,
      end_at: event_source.end&.date_time || event_source.end&.date,
      raw_event: event_source.to_h,
      status: 'active'
    }
    update_payload[:event_id] = event_source.id if detached_instance
    event_record.update!(update_payload)

    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'success',
      action_type: 'update_calendar_event',
      metadata: {
        event_id: target_event_id,
        title: event_record.title,
        changes: changes,
        updates: updates,
        snapshot: snapshot,
        calendar_response: event_source.to_h,
        detached_instance_id: detached_instance ? target_event_id : nil,
        detached_event_id: detached_instance&.id,
        verification: verification,
        scope: scope,
        correlation_id: @correlation_id
      }.compact
    )
    remember_last_event(event_record.id)
    remember_idempotency!('update_calendar_event', signature)
    refresh_household_calendar_data

    if verification[:mismatches].to_a.any?
      return build_response(
        "Updated the event, but these fields may not have changed: #{verification[:mismatches].join(', ')}.",
        action: 'calendar_event_updated',
        error_code: 'calendar_update_partial'
      )
    end

    response_lines = [
      "Updated the event. ✅",
      "Title: #{event_source.summary}",
      "Date: #{event_date(event_source)}",
      "Time: #{event_time_range(event_source)}",
      "Scope: #{scope_label(scope, detached_instance: detached_instance)}"
    ]
    if updates['recurrence_clear']
      response_lines << "Recurrence: cleared"
    elsif updates['recurrence_rules']
      response_lines << "Recurrence: #{updates['recurrence_rules'].join(', ')}"
    end
    if detached_instance
      response_lines << "Detached: this instance is now standalone"
    end
    build_response(response_lines.compact.join("\n"), event_created: true, action: 'calendar_event_updated')
  rescue GoogleCalendarClient::CalendarAuthError => e
    fingerprint = token_fingerprint(@user&.google_refresh_token)
    handle_calendar_auth_expired!(
      @user,
      error: e.message,
      calendar_id: event_record.calendar_id,
      source: 'web_chat_update'
    )
    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'error',
      action_type: 'update_calendar_event',
      metadata: {
        error_code: 'calendar_auth_expired',
        error: e.message,
        token_fingerprint: fingerprint,
        event_id: target_event_id,
        changes: changes,
        scope: scope,
        correlation_id: @correlation_id
      }
    )
    build_response(
      "Your calendar authorization expired. Please reconnect at https://finances.sifxtre.me.",
      error_code: 'calendar_auth_expired'
    )
  rescue GoogleCalendarClient::CalendarError => e
    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'error',
      action_type: 'update_calendar_event',
      metadata: {
        error_code: 'calendar_update_failed',
        error: e.message,
        event_id: target_event_id,
        changes: changes,
        scope: scope,
        correlation_id: @correlation_id
      }
    )
    build_response("Calendar update error: #{e.message}", error_code: 'calendar_update_failed')
  end

  def delete_event(event_record, scope: nil)
    if @user.google_refresh_token.to_s.empty?
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: 'error',
        action_type: 'delete_calendar_event',
        metadata: { error_code: 'insufficient_permissions', event_id: event_record.event_id, correlation_id: @correlation_id }
      )
      return build_response("Please connect your calendar at https://finances.sifxtre.me first.", error_code: 'insufficient_permissions')
    end

    scope ||= 'instance'
    target_event_id = scope == 'series' ? recurring_master_event_id(event_record) : event_record.event_id

    signature = idempotency_signature('delete_calendar_event', { event_id: target_event_id, scope: scope })
    if duplicate_action?('delete_calendar_event', signature)
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: 'duplicate',
        action_type: 'delete_calendar_event',
        metadata: { error_code: 'duplicate_request', event_id: target_event_id, scope: scope, correlation_id: @correlation_id }
      )
      return build_response("I already deleted that event. ✅", action: 'calendar_event_deleted')
    end

    client = GoogleCalendarClient.new(@user)
    client.delete_event(calendar_id: event_record.calendar_id, event_id: target_event_id)
    event_record.update!(status: 'cancelled')

    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'success',
      action_type: 'delete_calendar_event',
      metadata: {
        event_id: target_event_id,
        title: event_record.title,
        calendar_request: { calendar_id: event_record.calendar_id, event_id: target_event_id },
        scope: scope,
        correlation_id: @correlation_id
      }
    )
    remember_idempotency!('delete_calendar_event', signature)
    response_lines = [
      "Deleted the event. ✅",
      "Title: #{event_record.title}",
      "Date: #{event_record_date(event_record)}",
      "Time: #{event_record_time_range(event_record)}",
      "Scope: #{scope_label(scope, detached_instance: false)}"
    ]
    build_response(response_lines.compact.join("\n"), event_created: true, action: 'calendar_event_deleted')
  rescue GoogleCalendarClient::CalendarAuthError => e
    fingerprint = token_fingerprint(@user&.google_refresh_token)
    handle_calendar_auth_expired!(
      @user,
      error: e.message,
      calendar_id: event_record.calendar_id,
      source: 'web_chat_delete'
    )
    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'error',
      action_type: 'delete_calendar_event',
      metadata: {
        error_code: 'calendar_auth_expired',
        error: e.message,
        token_fingerprint: fingerprint,
        event_id: target_event_id,
        scope: scope,
        correlation_id: @correlation_id
      }
    )
    build_response(
      "Your calendar authorization expired. Please reconnect at https://finances.sifxtre.me.",
      error_code: 'calendar_auth_expired'
    )
  rescue GoogleCalendarClient::CalendarError => e
    log_action(
      @message,
      calendar_event_id: event_record.id,
      calendar_id: event_record.calendar_id,
      status: 'error',
      action_type: 'delete_calendar_event',
      metadata: { error_code: 'calendar_delete_failed', error: e.message, event_id: target_event_id, scope: scope, correlation_id: @correlation_id }
    )
    build_response("Calendar delete error: #{e.message}", error_code: 'calendar_delete_failed')
  end

  def create_transaction(transaction)
    if transaction['error']
      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'error', action_type: 'create_transaction', metadata: { error: transaction['message'] })
      return build_response(transaction['message'] || "I couldn't find a transaction.")
    end

    record = FinancialTransaction.create!(
      plaid_id: nil,
      plaid_name: transaction['merchant'],
      merchant_name: transaction['merchant'],
      category: transaction['category'],
      amount: transaction['amount'].to_f,
      transacted_at: parse_transaction_date(transaction['date']),
      source: normalize_source(transaction['source']),
      hidden: false,
      reviewed: true
    )

    log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'success', action_type: 'create_transaction', metadata: { transaction_id: record.id })

    build_response("Added the transaction. ✅", action: 'transaction_created')
  rescue StandardError => e
    log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'error', action_type: 'create_transaction', metadata: { error: e.message })
    build_response("Transaction error: #{e.message}")
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
    recurrence_label = format_recurrence(event['recurrence'])
    lines << "Repeats: #{recurrence_label}" if recurrence_label
    lines << "Location: #{event['location']}" if event['location'].present?
    lines << "Details: #{event['description']}" if event['description'].present?
    lines.join("\n")
  end

  def format_recurrence(recurrence)
    return nil if recurrence.nil?

    if recurrence.is_a?(String)
      return recurrence if recurrence.strip != ''
      return nil
    end

    return nil unless recurrence.is_a?(Hash)

    freq = recurrence['frequency'].to_s
    return nil if freq.empty?

    label = freq
    days = Array(recurrence['by_day']).map(&:to_s)
    label = "#{label} on #{days.join(', ')}" if days.any?
    label
  end

  def format_event_record(event)
    [
      "Title: #{event.title}",
      (event.start_at ? "Date: #{event.start_at.to_date}" : nil),
      (event.start_at ? "Time: #{event.start_at.strftime('%H:%M')}" : nil)
    ].compact.join("\n")
  end

  def format_event_brief(event)
    return event.title.to_s if event.start_at.nil?

    date_label = event.start_at.strftime('%b %d')
    time_label = event.start_at.strftime('%H:%M')
    end_label = event.end_at ? event.end_at.strftime('%H:%M') : nil
    time_range = end_label ? "#{time_label}-#{end_label}" : time_label
    "#{date_label} #{time_range} - #{event.title}"
  end

  def fallback_list_title(title)
    return title unless title.to_s.strip.empty?

    tokens = extract_query_tokens(@text)
    tokens.join(' ')
  end

  def extract_query_tokens(text)
    cleaned = text.to_s.downcase
    cleaned = cleaned.gsub(/[^a-z0-9\s]/, ' ')
    cleaned = cleaned.gsub(/\b(when|what|next|upcoming|event|events|find|show|list|the|a|an|is|are|me|please|for)\b/, ' ')
    tokens = cleaned.split(/\s+/).reject(&:empty?)
    tokens.map { |token| normalize_token(token) }.uniq
  end

  def normalize_token(token)
    return 'swim' if token == 'swimming'
    return 'swim' if token == 'swim'
    return token.sub(/ing$/, '') if token.length > 4 && token.end_with?('ing')
    token
  end

  def apply_title_filters(scope, title)
    tokens = extract_query_tokens(title)
    tokens.reduce(scope) do |rel, token|
      rel.where("title ILIKE ?", "%#{token}%")
    end
  end

  def format_event_changes(event_record, changes)
    lines = []
    lines << "Title: #{changes['title'] || event_record.title}"
    date = changes['date'] || event_record.start_at&.to_date
    lines << "Date: #{date}" if date
    time = changes['start_time'] || event_record.start_at&.strftime('%H:%M')
    end_time = changes['end_time']
    if end_time.to_s.empty? && changes['duration_minutes'].present? && date && time
      base_time = Time.zone.parse("#{date} #{time}")
      end_time = (base_time + changes['duration_minutes'].to_i.minutes).strftime('%H:%M') if base_time
    end
    end_time = event_record.end_at&.strftime('%H:%M') if end_time.to_s.empty?
    time_range = [time, end_time].compact.join(' - ')
    lines << "Time: #{time_range}" if time_range.present?
    if changes['recurrence_clear']
      lines << "Repeats: none"
    else
      recurrence_label = format_recurrence(changes['recurrence'])
      lines << "Repeats: #{recurrence_label}" if recurrence_label
    end
    if changes['location'] || event_record.location
      lines << "Location: #{changes['location'] || event_record.location}"
    end
    if changes['description'] || event_record.description
      lines << "Details: #{changes['description'] || event_record.description}"
    end
    lines.join("\n")
  end

  def format_transaction(transaction)
    lines = []
    lines << "Merchant: #{transaction['merchant']}" if transaction['merchant'].present?
    lines << "Amount: #{transaction['amount']}" if transaction['amount'].present?
    lines << "Date: #{transaction['date']}" if transaction['date'].present?
    lines << "Category: #{transaction['category']}" if transaction['category'].present?
    lines << "Source: #{transaction['source']}" if transaction['source'].present?
    lines.join("\n")
  end

  def create_memory(data)
    memory = Memory.create!(
      user: @user,
      content: data['content'],
      category: data['category'],
      source: 'chat',
      status: 'active',
      metadata: memory_metadata(data)
    )
    attach_memory_image(memory)

    log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'success', action_type: 'create_memory', metadata: { memory_id: memory.id })
    build_response("Saved that memory. ✅", action: 'memory_created')
  rescue StandardError => e
    log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'error', action_type: 'create_memory', metadata: { error: e.message })
    build_response("Memory error: #{e.message}")
  end

  def search_memories(query_text)
    memories = Memory.where(user: @user, status: 'active')

    terms = query_text.to_s.split(/\s+/).map(&:strip).reject(&:empty?)
    terms.each do |term|
      memories = memories.where("content ILIKE ? OR category ILIKE ?", "%#{term}%", "%#{term}%")
    end

    memories.order(created_at: :desc).limit(10).map do |memory|
      {
        content: memory.content,
        category: memory.category,
        urls: memory.metadata['urls']
      }
    end
  end

  def format_memory(memory)
    lines = []
    lines << "Content: #{memory['content']}" if memory['content'].present?
    lines << "Category: #{memory['category']}" if memory['category'].present?
    if memory['urls'].is_a?(Array) && memory['urls'].any?
      lines << "Links: #{memory['urls'].join(', ')}"
    end
    lines.join("\n")
  end

  def format_memory_list(memories)
    memories.map do |memory|
      label = memory[:category] ? "[#{memory[:category]}] " : ""
      url_part = memory[:urls]&.any? ? " (#{memory[:urls].join(', ')})" : ""
      "• #{label}#{memory[:content]}#{url_part}"
    end.join("\n")
  end

  def memory_metadata(data)
    metadata = (data['metadata'] || {}).dup
    urls = Array(data['urls']).map(&:to_s).map(&:strip).reject(&:empty?)
    metadata['urls'] = urls if urls.any?
    metadata['chat_message_id'] = @message.id
    metadata
  end

  def attach_memory_image(memory)
    return unless image_attached?

    memory.image.attach(@message.image.blob)
  end

  def extract_urls(text)
    text.to_s.scan(%r{https?://[^\s]+}i).uniq
  end

  def strip_urls(text)
    text.to_s.gsub(%r{https?://[^\s]+}i, '').strip
  end

  def classify_intent
    result = gemini.classify_intent(text: @text, has_image: image_attached?)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'intent',
      model: gemini_intent_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
    result[:event]
  rescue StandardError => e
    log_ai_request(
      @message,
      {},
      request_kind: 'intent',
      model: gemini_intent_model,
      status: 'error',
      error_message: e.message,
      metadata: ai_metadata
    )
    { 'intent' => 'create_event', 'confidence' => 'low' }
  end

  def normalize_confidence(value)
    return 'medium' if value.to_s.empty?

    normalized = value.to_s.downcase
    return normalized if CONFIDENCE_ORDER.key?(normalized)

    'medium'
  end

  def resolve_intent_from_text
    text = @text.downcase
    return 'create_memory' if text.match?(/remember|note this|save this|keep in mind/)
    return 'search_memory' if text.match?(/do you remember|what do you know|what did we decide|what's the note/)
    return 'delete_event' if text.match?(/delete|remove|cancel/)
    return 'update_event' if text.match?(/update|change|move|reschedule/)
    return 'create_transaction' if text.match?(/transaction|expense|spent|charge|paid|receipt|purchase/)

    'create_event'
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

  def find_event_candidates(query)
    title = query['title'].to_s.strip
    date = query['date'].to_s.strip
    time = query['start_time'].to_s.strip

    return [] if title.empty? && date.empty?

    scope = CalendarEvent.where(user: @user).where.not(status: 'cancelled')
    if date.present?
      day = Date.parse(date) rescue nil
      if day
        scope = scope.where(start_at: day.beginning_of_day..day.end_of_day)
      end
    else
      start_at = Time.zone.today - CALENDAR_WINDOW_PAST_DAYS.days
      end_at = Time.zone.today + CALENDAR_WINDOW_FUTURE_DAYS.days
      scope = scope.where(start_at: start_at.beginning_of_day..end_at.end_of_day)
    end

    events = scope.limit(50).to_a
    normalized_query = normalize_title(title)
    query_tokens = tokenize_title(title)
    scored = events.map do |event|
      event_title = event.title.to_s
      normalized_event = normalize_title(event_title)
      event_tokens = tokenize_title(event_title)
      score = 0
      if normalized_query.present?
        score += 5 if normalized_event == normalized_query
        score += 3 if normalized_event.include?(normalized_query)
        overlap = (event_tokens & query_tokens).length
        coverage = query_tokens.empty? ? 0 : overlap.to_f / query_tokens.length
        score += overlap
        score += (coverage * 3).round
      end
      if date.present? && event.start_at
        begin
          target_date = Date.parse(date)
          score += 3 if event.start_at.to_date == target_date
        rescue ArgumentError
        end
      end
      if time.present? && event.start_at
        target_time = Time.zone.parse("#{event.start_at.to_date} #{time}") rescue nil
        if target_time
          diff = (event.start_at - target_time).abs
          score += 2 if diff <= 60.minutes
          score += 1 if diff <= 15.minutes
        end
      end
      distance = event.start_at ? (event.start_at - Time.zone.now).abs : 10.years
      { event: event, score: score, distance: distance }
    end

    scored.select { |entry| entry[:score] > 0 }
      .sort_by { |entry| [-entry[:score], entry[:distance]] }
  end

  def find_event_candidates_with_fallback(query)
    candidates = find_event_candidates(query)
    return candidates if candidates.any?

    title = query['title'].to_s.strip
    return [] if title.empty?

    relaxed = query.dup
    relaxed.delete('date')
    relaxed.delete('start_time')
    candidates = find_event_candidates(relaxed)
    return candidates if candidates.any?

    fuzzy_event_candidates(title)
  end

  def fuzzy_event_candidates(title)
    return [] if title.to_s.strip.empty?

    start_at = Time.zone.today - CALENDAR_WINDOW_PAST_DAYS.days
    end_at = Time.zone.today + CALENDAR_WINDOW_FUTURE_DAYS.days
    quoted_title = ActiveRecord::Base.connection.quote(title)

    scope = CalendarEvent.where(user: @user)
                         .where.not(status: 'cancelled')
                         .where(start_at: start_at.beginning_of_day..end_at.end_of_day)
    results = scope
              .select("calendar_events.*, similarity(title, #{quoted_title}) AS similarity_score")
              .where("similarity(title, #{quoted_title}) > 0.2")
              .order(Arel.sql("similarity(title, #{quoted_title}) DESC"))
              .limit(10)
              .to_a

    results.map do |event|
      similarity = event.respond_to?(:similarity_score) ? event.similarity_score.to_f : 0
      distance = event.start_at ? (event.start_at - Time.zone.now).abs : 10.years
      { event: event, score: (similarity * 10).round(2), distance: distance }
    end
  end

  def serialize_candidates(candidates)
    candidates.map do |entry|
      event = entry[:event]
      {
        'id' => event.id,
        'title' => event.title,
        'start_at' => event.start_at&.iso8601
      }
    end
  end

  def format_candidates(candidates)
    candidates.first(5).each_with_index.map do |entry, idx|
      event = entry[:event]
      time_label = event.start_at ? event.start_at.strftime('%b %d %H:%M') : 'Unknown time'
      "#{idx + 1}) #{event.title} — #{time_label}"
    end.join("\n")
  end

  def selection_index_from_text(max_count)
    match = @text.to_s.match(/\b(\d+)\b/)
    return nil unless match

    index = match[1].to_i
    return nil if index < 1 || index > max_count

    index
  end

  def event_snapshot(event)
    {
      id: event.id,
      event_id: event.event_id,
      title: event.title,
      start_at: event.start_at&.iso8601,
      end_at: event.end_at&.iso8601,
      calendar_id: event.calendar_id,
      updated_at: event.updated_at&.iso8601
    }
  end

  def idempotency_signature(action_type, payload)
    Digest::SHA256.hexdigest([action_type, @user.id, payload.to_json].join('|'))
  end

  def duplicate_action?(action_type, signature)
    info = thread_state['last_action']
    return false unless info.is_a?(Hash)
    return false unless info['action_type'] == action_type
    return false unless info['signature'] == signature

    timestamp = Time.zone.parse(info['created_at'].to_s) rescue nil
    return false unless timestamp

    timestamp > (Time.zone.now - IDEMPOTENCY_WINDOW_SECONDS)
  end

  def remember_idempotency!(action_type, signature)
    merge_thread_state(
      'last_action' => {
        'action_type' => action_type,
        'signature' => signature,
        'created_at' => Time.zone.now.iso8601
      }
    )
  end

  def verify_event_updates(event, updates)
    return { verified: false, error: 'missing_event' } unless event

    mismatches = []
    mismatches << 'title' if updates['title'] && event.summary.to_s != updates['title'].to_s
    mismatches << 'location' if updates['location'] && event.location.to_s != updates['location'].to_s
    mismatches << 'description' if updates['description'] && event.description.to_s != updates['description'].to_s

    actual_date = event.start&.date || event.start&.date_time&.to_date&.iso8601
    actual_start_time = event.start&.date_time&.strftime('%H:%M')
    actual_end_time = event.end&.date_time&.strftime('%H:%M')

    mismatches << 'date' if updates['date'] && actual_date.to_s != updates['date'].to_s
    mismatches << 'start_time' if updates['start_time'] && actual_start_time.to_s != updates['start_time'].to_s
    mismatches << 'end_time' if updates['end_time'] && actual_end_time.to_s != updates['end_time'].to_s
    if updates['recurrence_rules']
      actual_recurrence = Array(event.recurrence).map(&:to_s)
      mismatches << 'recurrence' if actual_recurrence != Array(updates['recurrence_rules']).map(&:to_s)
    end

    {
      verified: true,
      mismatches: mismatches,
      actual: {
        date: actual_date,
        start_time: actual_start_time,
        end_time: actual_end_time
      }
    }
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

  def format_context_line(message)
    content = message.text.to_s.strip
    content = "[image]" if content.empty? && message.has_image
    return nil if content.empty?

    content = "#{content[0, 200]}..." if content.length > 200
    label = message.role == 'assistant' ? 'Assistant' : 'User'
    "#{label}: #{content}"
  end

  def pick_candidate(candidates)
    match = @text.to_s.match(/\b(\d+)\b/)
    if match
      index = match[1].to_i - 1
      return candidates[index] if index >= 0 && index < candidates.length
    end

    lowered = @text.downcase
    candidates.find { |entry| entry[:event].title.to_s.downcase.include?(lowered) }
  end

  def primary_calendar_id
    CalendarConnection.where(user: @user, primary: true).limit(1).pluck(:calendar_id).first || @user.email || 'primary'
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

  def parse_duration_minutes(text)
    return nil if text.to_s.strip.empty?

    normalized = text.downcase
    hours_match = normalized.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr)\b/)
    if hours_match
      hours = hours_match[1].to_f
      return (hours * 60).round if hours.positive?
    end

    minutes_match = normalized.match(/(\d+)\s*(minutes?|mins?|min)\b/)
    if minutes_match
      minutes = minutes_match[1].to_i
      return minutes if minutes.positive?
    end

    nil
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

  def parse_transaction_date(date_str)
    Date.parse(date_str)
  rescue ArgumentError
    Date.current
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

  def refresh_household_calendar_data
    users = household_users
    users.each do |user|
      next if user.google_refresh_token.to_s.empty?

      begin
        sync_calendar_list_for(user)
      rescue GoogleCalendarClient::CalendarAuthError => e
        handle_calendar_auth_expired!(
          user,
          error: e.message,
          calendar_id: nil,
          source: 'calendar_list_sync'
        )
        Rails.logger.warn("[CalendarUpdate] Calendar auth expired user_id=#{user.id} error=#{e.message}")
      rescue GoogleCalendarClient::CalendarError => e
        Rails.logger.warn("[CalendarUpdate] Calendar list sync failed user_id=#{user.id} error=#{e.message}")
      end
    end

    begin
      SyncCalendarEvents.perform_for_users(users)
    rescue StandardError => e
      Rails.logger.warn("[CalendarSync] Failed during chat refresh user_id=#{@user&.id} error=#{e.message}")
    end
  end

  def household_users
    emails = (spouse_emails(@user) + [@user.email]).uniq
    User.where(email: emails)
  end

  def sync_calendar_list_for(user)
    client = GoogleCalendarClient.new(user)
    calendars = client.list_calendars

    calendars.each do |cal|
      CalendarConnection.find_or_initialize_by(user: user, calendar_id: cal[:id]).update(
        summary: cal[:summary],
        access_role: cal[:access_role],
        primary: cal[:primary] || false,
        time_zone: cal[:time_zone]
      )
    end
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

  def handle_calendar_auth_expired!(user, error: nil, calendar_id: nil, source: 'unknown')
    return if user.nil?

    fingerprint = token_fingerprint(user.google_refresh_token)
    user.update(google_refresh_token: nil)
    CalendarConnection.where(user: user).update_all(sync_enabled: false)
    CalendarAuthLog.create!(
      user: user,
      calendar_id: calendar_id,
      source: source,
      error_code: 'invalid_grant',
      error_message: error,
      token_fingerprint: fingerprint,
      metadata: { correlation_id: @correlation_id }.compact
    )
    Rails.logger.warn("[CalendarAuth] Revoked refresh token for user_id=#{user.id} token_fingerprint=#{fingerprint} error=#{error}") if error
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

  def ai_metadata(response: nil, request: nil, extra: {})
    base_request = request || { text: @text, has_image: image_attached? }
    { request: base_request, response: response, correlation_id: @correlation_id }.merge(extra).compact
  end

  def resolve_recurring_scope(text)
    result = gemini.extract_recurring_scope_from_text(text, context: recent_context_text)
    log_ai_request(
      @message,
      result[:usage],
      request_kind: 'recurring_scope',
      model: gemini_intent_model,
      status: result[:event]['error'] ? 'error' : 'success',
      metadata: ai_metadata(response: result[:event])
    )
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

  def log_ai_request(message, usage, request_kind:, model:, status:, error_message: nil, metadata: {})
    usage ||= {}
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

  def build_response(text, event_created: false, action: nil, error_code: nil)
    { text: text, event_created: event_created, action: action, error_code: error_code }.compact
  end
end
