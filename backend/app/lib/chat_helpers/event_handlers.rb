module ChatHelpers
  module EventHandlers
    def handle_create_event(image_message_id: nil)
      flow_engine.handle_create(:event, image_message_id: image_message_id)
    end

    def handle_update_event
      result = gemini.extract_event_update_from_text(@text, context: recent_context_text)
      log_ai_result(result, request_kind: 'event_update', model: gemini_intent_model)
      data = result[:event] || {}

      changes = (data['changes'] || {}).compact
      changes['confidence'] = data['confidence'] if data['confidence']
      duration_minutes = parse_duration_minutes(@text)
      changes['duration_minutes'] = duration_minutes if duration_minutes
      changes['recurrence'] = normalize_recurrence(changes['recurrence'])
      changes['recurrence_clear'] = true if changes['recurrence_clear']
      if changes.empty?
        set_pending_action('clarify_update_changes', { 'target' => (data['target'] || {}).compact })
        return build_response(
          clarify_missing_details(
            intent: 'update_event_changes',
            missing_fields: ['changes'],
            extracted: data,
            fallback: "What should I change about the event?"
          )
        )
      end

      target = (data['target'] || {}).compact
      if target.empty?
        if (recent_event = last_event_record)
          return confirm_or_update_event(recent_event, changes)
        end
        set_pending_action('clarify_update_target', { 'changes' => changes })
        return build_response(
          clarify_missing_details(
            intent: 'update_event_target',
            missing_fields: ['title', 'date'],
            extracted: changes,
            fallback: "Which event should I update? Please share the title and date."
          )
        )
      end

      result = handle_event_candidate_flow(
        target,
        action_type: 'update',
        changes: changes,
        clarify_action: 'clarify_update_target',
        clarify_fallback: "I couldn't find that event. Can you share the title and date?"
      )
      return result if result
    rescue StandardError => e
      build_response("Update error: #{e.message}")
    end

    def handle_update_target_clarification(payload)
      changes = payload['changes'] || {}
      query = extract_event_query
      return query if query.is_a?(Hash) && query[:text]
      data = query[:event]

      if data['error']
        if (recent_event = last_event_record)
          clear_thread_state
          return confirm_or_update_event(recent_event, changes)
        end
        return build_response(
          clarify_missing_details(
            intent: 'update_event_target',
            missing_fields: ['title', 'date'],
            extracted: changes,
            fallback: "I still need the event title or date."
          )
        )
      end

      result = handle_event_candidate_flow(
        data,
        action_type: 'update',
        changes: changes,
        clarify_action: 'clarify_update_target',
        clarify_fallback: "I couldn't find that event. Can you share the title and date?",
        clear_state: true
      )
      return result if result
    rescue StandardError => e
      build_response("Update error: #{e.message}")
    end

    def handle_update_changes_clarification(payload)
      target = (payload['target'] || {}).compact
      result = gemini.extract_event_update_from_text(@text, context: recent_context_text)
      log_ai_result(result, request_kind: 'event_update', model: gemini_intent_model)
      data = result[:event] || {}

      changes = (data['changes'] || {}).compact
      changes['confidence'] = data['confidence'] if data['confidence']
      duration_minutes = parse_duration_minutes(@text)
      changes['duration_minutes'] = duration_minutes if duration_minutes
      changes['recurrence'] = normalize_recurrence(changes['recurrence'])
      changes['recurrence_clear'] = true if changes['recurrence_clear']

      if changes.empty?
        return build_response(
          clarify_missing_details(
            intent: 'update_event_changes',
            missing_fields: ['changes'],
            extracted: target,
            fallback: "I still need what to change (time, date, title, etc.)."
          )
        )
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

      result = handle_event_candidate_flow(
        target,
        action_type: 'update',
        changes: changes,
        clarify_action: 'clarify_update_target',
        clarify_fallback: "I couldn't find that event. Can you share the title and date?",
        clear_state: true
      )
      return result if result
    rescue StandardError => e
      build_response("Update error: #{e.message}")
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
      query = extract_event_query
      return query if query.is_a?(Hash) && query[:text]
      data = query[:event]

      if data['error']
        return build_response(
          clarify_missing_details(
            intent: 'delete_event_target',
            missing_fields: ['title', 'date'],
            extracted: {},
            fallback: "Which event should I delete? Please share the title and date."
          )
        )
      end

      result = handle_event_candidate_flow(
        data,
        action_type: 'delete',
        clarify_action: 'clarify_delete_target',
        clarify_fallback: "I couldn't find that event. Can you share the title and date?"
      )
      return result if result
    rescue StandardError => e
      build_response("Delete error: #{e.message}")
    end

    def handle_delete_target_clarification(_payload)
      query = extract_event_query
      return query if query.is_a?(Hash) && query[:text]
      data = query[:event]

      if data['error']
        return build_response(
          clarify_missing_details(
            intent: 'delete_event_target',
            missing_fields: ['title', 'date'],
            extracted: {},
            fallback: "I still need the event title or date."
          )
        )
      end

      result = handle_event_candidate_flow(
        data,
        action_type: 'delete',
        clarify_action: 'clarify_delete_target',
        clarify_fallback: "I couldn't find that event. Can you share the title and date?",
        clear_state: true
      )
      return result if result
    rescue StandardError => e
      build_response("Delete error: #{e.message}")
    end

    def handle_list_events
      query = extract_event_query
      return query if query.is_a?(Hash) && query[:text]
      data = query[:event] || {}
      if data['error']
        set_pending_action('clarify_list_query', { 'query' => {} })
        return build_response(
          clarify_missing_details(
            intent: 'list_events',
            missing_fields: ['date', 'title'],
            extracted: {},
            fallback: data['message'] || "What date or title should I look for?"
          )
        )
      end

      events, title, date = list_events_for_query(data)
      if events.empty?
        return handle_list_empty_results(data, title: title, date: date)
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

    def handle_list_query_clarification(_payload)
      query = extract_event_query
      return query if query.is_a?(Hash) && query[:text]
      data = query[:event] || {}
      if data['error']
        return build_response(
          clarify_missing_details(
            intent: 'list_events',
            missing_fields: ['date', 'title'],
            extracted: {},
            fallback: data['message'] || "What date or title should I look for?"
          )
        )
      end

      events, title, date = list_events_for_query(data)
      if events.empty?
        return handle_list_empty_followup(title: title, date: date)
      end

      clear_thread_state
      lines = events.map { |event| format_event_brief(event) }
      build_response("Here are the next matches:\n#{lines.join("\n")}")
    rescue StandardError => e
      build_response("List error: #{e.message}")
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

    def handle_event_extraction_selection(payload)
      events = extracted_events(payload['events'])
      if events.empty?
        return build_response("Reply with the event numbers to add, or say \"all\".")
      end

      indices = selection_indices_from_text(events.length)
      if indices.nil?
        return build_response("Reply with the event numbers to add, or say \"all\".")
      end

      if indices == :all
        selected = events
      elsif indices.empty?
        return build_response("Reply with the event numbers to add, or say \"all\".")
      else
        selected = indices.map { |idx| events[idx] }.compact
      end
      selected.each { |event| event['recurrence'] = normalize_recurrence(event['recurrence']) }

      if (missing_entry = selected.find { |event| missing_event_fields(event).any? })
        missing = missing_event_fields(missing_entry)
        pending_payload = { 'event' => missing_entry, 'missing_fields' => missing }
        pending_payload = merge_pending_payload(pending_payload, payload['image_message_id'])
        set_pending_action('clarify_event_fields', pending_payload)
        return build_response(
          clarify_missing_details(
            intent: 'create_event',
            missing_fields: missing,
            extracted: missing_entry,
            fallback: "I need #{missing.join(', ')} to add this event."
          )
        )
      end

      results = selected.map { |event| create_event(event) }
      created_titles = selected.map { |event| event['title'].presence || 'Untitled event' }
      errors = results.select { |result| result.is_a?(Hash) && result[:error_code].present? }.map { |result| result[:text] }.compact

      clear_thread_state
      if errors.any?
        return build_response(
          "Added #{created_titles.length - errors.length} events. Some failed:\n#{errors.map { |err| "- #{err}" }.join("\n")}",
          action: 'calendar_event_created'
        )
      end

      build_response(
        "Added #{created_titles.length} events. ✅\n#{created_titles.map { |title| "- #{title}" }.join("\n")}",
        action: 'calendar_event_created'
      )
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
  end
end
