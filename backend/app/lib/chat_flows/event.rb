require 'chat_constants'

module ChatFlows
  class Event < Base
    def kind
      :event
    end

    def intent
      ChatConstants::Intent::CREATE_EVENT
    end

    def plural_label
      'events'
    end

    def singular_label
      'event'
    end

    def payload_key
      'event'
    end

    def extract(image_message_id: nil)
      if image_message_id
        handler.extract_event_from_message(image_message_id, context: handler.text_context)
      elsif handler.image_attached?
        handler.extract_from_image
      else
        handler.extract_from_text
      end
    end

    def normalize(payload)
      payload['recurrence'] = handler.normalize_recurrence(payload['recurrence'])
      payload
    end

    def missing_fields(payload)
      handler.missing_event_fields(payload)
    end

    def error_missing_fields
      ['title', 'date', 'time']
    end

    def error_fallback
      'What is the title, date, and time?'
    end

    def confirm_prompt(payload, stage: :initial)
      base = stage == :corrected ? 'Got it. Here’s the event:' : 'I found this event:'
      "#{base}\n\n#{handler.format_event(payload)}\n\nShould I add it?"
    end

    def execute(payload)
      handler.create_event(payload)
    end

    def multi_items(payload)
      handler.extracted_events(payload)
    end

    def multi_formatter(items)
      handler.format_extracted_candidates(items)
    end

    def multi_action
      ChatConstants::PendingAction::SELECT_EVENT_FROM_EXTRACTION
    end

    def multi_payload_key
      'events'
    end

    def clarify_action
      ChatConstants::PendingAction::CLARIFY_EVENT_FIELDS
    end

    def confirm_action
      ChatConstants::PendingAction::CONFIRM_EVENT
    end
  end
end
