module ChatHelpers
  module EventHandlers
    def handle_create_event(image_message_id: nil)
      flow_engine.handle_create(:event, image_message_id: image_message_id)
    end

    def handle_update_event
      flow_engine.handle_update
    end

    def handle_update_target_clarification(payload)
      flow_engine.handle_update_target_clarification(payload)
    end

    def handle_update_changes_clarification(payload)
      flow_engine.handle_update_changes_clarification(payload)
    end

    def handle_delete_event
      flow_engine.handle_delete
    end

    def handle_delete_target_clarification(payload)
      flow_engine.handle_delete_target_clarification(payload)
    end

    def handle_list_events
      query = extract_event_query
      return query if query.is_a?(Hash) && query[:text]
      data = query[:event] || {}
      if data['error']
        set_pending_action(ChatConstants::PendingAction::CLARIFY_LIST_QUERY, { 'query' => {} })
        return build_response(
          clarify_missing_details(
            intent: ChatConstants::Intent::LIST_EVENTS,
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
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::LIST_EVENTS,
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
            intent: ChatConstants::Intent::LIST_EVENTS,
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
      if action_type == 'delete'
        flow_engine.handle_delete_selection(payload)
      else
        flow_engine.handle_update_selection(payload)
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
        set_pending_action(ChatConstants::PendingAction::CLARIFY_EVENT_FIELDS, pending_payload)
        return build_response(
          clarify_missing_details(
            intent: ChatConstants::Intent::CREATE_EVENT,
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
          action: ChatConstants::FrontendAction::CALENDAR_EVENT_CREATED
        )
      end

      build_response(
        "Added #{created_titles.length} events. ✅\n#{created_titles.map { |title| "- #{title}" }.join("\n")}",
        action: ChatConstants::FrontendAction::CALENDAR_EVENT_CREATED
      )
    end

  end
end
