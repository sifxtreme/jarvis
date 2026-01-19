module ChatHelpers
  module Confirmations
    def handle_memory_correction(payload)
      if payload['force_content']
        content = @text.to_s.strip
        urls = extract_urls(@text)
        if content.empty?
          set_pending_action('clarify_memory_fields', payload)
          return build_response(
            clarify_missing_details(
              intent: 'create_memory',
              missing_fields: ['content'],
              extracted: payload['memory'] || {},
              extra: 'An image is attached. Ask what the user wants to remember from the image. Do not mention events.',
              fallback: "What should I remember from this image?"
            )
          )
        end

        data = {
          'content' => content,
          'category' => payload['category'].presence || 'image',
          'urls' => urls.presence
        }.compact
        return create_memory(data)
      end

      result = extract_memory_from_text
      return result if result.is_a?(Hash) && result[:text]

      updated = result[:event] || {}
      if updated['error']
        set_pending_action('clarify_memory_fields', { 'memory' => {} })
        return build_response(
          clarify_missing_details(
            intent: 'create_memory',
            missing_fields: ['content'],
            extracted: {},
            fallback: updated['message'] || "What should I remember?"
          )
        )
      end

      flow_engine.handle_correction(:memory, updated, image_message_id: payload['image_message_id'])
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

    def handle_event_correction(payload)
      event = payload['event'] || {}
      image_message_id = payload['image_message_id']
      if image_message_id && payload['missing_fields'].present?
        result = extract_event_from_message(image_message_id, context: @text.presence || recent_context_text)
        unless result.is_a?(Hash) && result[:text]
          extracted = result[:event] || {}
          if extracted['error'].nil?
            return flow_engine.handle_correction(:event, extracted, image_message_id: image_message_id)
          end
        end
      end

      result = gemini.apply_event_correction(event, @text)
      log_ai_result(result, request_kind: 'event_correction', model: gemini_extract_model)

      updated = result[:event] || {}
      if updated['error']
        clear_thread_state
        return build_response(updated['message'] || "I couldn't update the event.")
      end

      flow_engine.handle_correction(:event, updated, image_message_id: image_message_id)
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

    def handle_update_confirmation(payload)
      event_id = payload['event_id']
      snapshot = payload['snapshot']
      changes = payload['changes'] || {}
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
        return apply_event_update(event_record, changes, snapshot: snapshot)
      end

      clear_thread_state
      build_response("Okay, what should I change?")
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

    def handle_transaction_correction(payload)
      transaction = payload['transaction'] || {}
      image_message_id = payload['image_message_id']
      if image_message_id && payload['missing_fields'].present?
        result = extract_transaction_from_message(image_message_id, context: @text.presence || recent_context_text)
        unless result.is_a?(Hash) && result[:text]
          extracted = result[:event] || {}
          if extracted['error'].nil?
            return flow_engine.handle_correction(:transaction, extracted, image_message_id: image_message_id)
          end
        end
      end

      result = gemini.apply_transaction_correction(transaction, @text)
      log_ai_result(result, request_kind: 'transaction_correction', model: gemini_extract_model)

      updated = result[:event] || {}
      if updated['error']
        clear_thread_state
        return build_response(updated['message'] || "I couldn't update the transaction.")
      end

      flow_engine.handle_correction(:transaction, updated, image_message_id: image_message_id)
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
  end
end
