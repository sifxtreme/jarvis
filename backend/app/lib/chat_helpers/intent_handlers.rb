module ChatHelpers
  module IntentHandlers
    def handle_clarified_intent(payload)
      intent_result = classify_intent || {}
      intent = intent_result['intent']
      confidence = normalize_confidence(intent_result['confidence'])
      image_message_id = payload['image_message_id']

      # Still ambiguous? Ask again with more specific guidance
      if confidence == 'low' || intent == ChatConstants::Intent::AMBIGUOUS
        set_pending_action(
          ChatConstants::PendingAction::CLARIFY_INTENT,
          { 'image_message_id' => image_message_id }
        )
        clarification = generate_intent_clarification(is_followup: true)
        return build_response(clarification)
      end

      clear_thread_state

      case intent
      when ChatConstants::Intent::CREATE_TRANSACTION
        handle_create_transaction(image_message_id: image_message_id)
      when ChatConstants::Intent::CREATE_MEMORY
        handle_create_memory
      when ChatConstants::Intent::SEARCH_MEMORY
        handle_search_memory
      when ChatConstants::Intent::DELETE_EVENT
        handle_delete_event
      when ChatConstants::Intent::UPDATE_EVENT
        handle_update_event
      when ChatConstants::Intent::LIST_EVENTS
        handle_list_events
      when ChatConstants::Intent::DIGEST
        handle_digest
      else
        handle_create_event(image_message_id: image_message_id)
      end
    end
  end
end
