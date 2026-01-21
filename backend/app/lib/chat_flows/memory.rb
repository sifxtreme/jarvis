require 'chat_constants'

module ChatFlows
  class Memory < Base
    def kind
      :memory
    end

    def intent
      ChatConstants::Intent::CREATE_MEMORY
    end

    def plural_label
      'memories'
    end

    def singular_label
      'memory'
    end

    def payload_key
      'memory'
    end

    def preflight
      urls = handler.extract_urls(handler.text)
      if handler.image_attached? && handler.text.strip.empty?
        return { action: :execute, payload: { 'content' => 'Saved image', 'category' => 'image', 'urls' => urls } }
      end

      if urls.any? && handler.strip_urls(handler.text).strip.empty?
        return { action: :execute, payload: { 'content' => 'Saved link', 'category' => 'link', 'urls' => urls } }
      end

      nil
    end

    def extract(_image_message_id: nil)
      handler.extract_memory_from_text
    end

    def normalize(payload)
      urls = handler.extract_urls(handler.text)
      payload['urls'] = urls if urls.any?
      payload
    end

    def missing_fields(payload)
      handler.missing_memory_fields(payload)
    end

    def error_missing_fields
      ['content']
    end

    def error_fallback
      'What should I remember?'
    end

    def missing_fallback(_missing_fields, _payload)
      'What should I remember?'
    end

    def correction_fallback(_missing_fields, _payload)
      'What should I remember?'
    end

    def confirm_prompt(payload, stage: :initial)
      "Should I save this memory?\n\n#{handler.format_memory(payload)}"
    end

    def execute(payload)
      handler.create_memory(payload)
    end

    def clarify_action
      ChatConstants::PendingAction::CLARIFY_MEMORY_FIELDS
    end

    def confirm_action
      ChatConstants::PendingAction::CONFIRM_MEMORY
    end

    def extra_prompt(stage:, _payload:, missing_fields:)
      return nil unless handler.image_attached?
      return nil unless missing_fields.include?('content')

      'An image is attached. Ask what the user wants to remember from the image. Do not mention events.'
    end

    def pending_adjuster(payload:, extracted:, missing_fields:, stage:)
      return payload unless handler.image_attached?
      return payload unless missing_fields.include?('content')

      payload.merge('force_content' => true, 'category' => 'image')
    end
  end
end
