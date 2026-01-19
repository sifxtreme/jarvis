module ChatHelpers
  module IntentHandlers
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
  end
end
