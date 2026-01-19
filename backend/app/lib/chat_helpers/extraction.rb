module ChatHelpers
  module Extraction
    def classify_image_intent
      return {} unless image_attached?

      image_base64, mime_type = gemini_image_payload(@image)
      result = gemini.classify_image_intent(image_base64, mime_type: mime_type, text: @text, context: recent_context_text)
      log_ai_result(result, request_kind: 'image_intent', model: gemini_intent_model)
      result[:event] || {}
    rescue StandardError => e
      log_ai_error(request_kind: 'image_intent', model: gemini_intent_model, error: e.message)
      {}
    end

    def classify_intent
      image_base64 = nil
      mime_type = nil
      if image_attached?
        image_base64, mime_type = gemini_image_payload(@image)
      end
      result = gemini.classify_intent(
        text: @text,
        has_image: image_attached?,
        context: recent_context_text,
        image_base64: image_base64,
        mime_type: mime_type
      )
      log_ai_result(result, request_kind: 'intent', model: gemini_intent_model)
      result[:event]
    rescue StandardError => e
      log_ai_error(request_kind: 'intent', model: gemini_intent_model, error: e.message)
      { 'intent' => 'create_event', 'confidence' => 'low' }
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

    def extract_from_text
      result = gemini.extract_event_from_text(@text, context: recent_context_text)
      log_ai_result(result, request_kind: 'text', model: gemini_extract_model)
      result
    rescue StandardError => e
      log_ai_error(request_kind: 'text', model: gemini_extract_model, error: e.message)
      { text: "Text extraction error: #{e.message}" }
    end

    def extract_memory_from_text
      result = gemini.extract_memory_from_text(@text)
      log_ai_result(result, request_kind: 'memory', model: gemini_extract_model)
      result
    rescue StandardError => e
      { text: "Memory error: #{e.message}" }
    end

    def extract_event_query
      query = gemini.extract_event_query_from_text(@text, context: recent_context_text)
      log_ai_result(query, request_kind: 'event_query', model: gemini_intent_model)
      query
    rescue StandardError => e
      { text: "Event query error: #{e.message}" }
    end

    def extract_from_image
      image_base64, mime_type = gemini_image_payload(@image)
      result = gemini.extract_event_from_image(image_base64, mime_type: mime_type, context: @text.presence || recent_context_text)
      log_ai_result(result, request_kind: 'image', model: gemini_extract_model)
      result
    rescue StandardError => e
      log_ai_error(request_kind: 'image', model: gemini_extract_model, error: e.message)
      { text: "Image extraction error: #{e.message}" }
    end

    def extract_event_from_message(message_id, context: nil)
      message = ChatMessage.find_by(id: message_id)
      return { text: "I couldn't find that image anymore." } unless message&.image&.attached?

      image_base64, mime_type = gemini_image_payload(message.image)
      result = gemini.extract_event_from_image(image_base64, mime_type: mime_type, context: context)
      log_ai_result(result, request_kind: 'image', model: gemini_extract_model)
      result
    rescue StandardError => e
      { text: "Image extraction error: #{e.message}" }
    end

    def extract_transaction_from_text
      result = gemini.extract_transaction_from_text(@text, context: recent_context_text)
      log_ai_result(result, request_kind: 'transaction_text', model: gemini_extract_model)
      result
    rescue StandardError => e
      { text: "Transaction extraction error: #{e.message}" }
    end

    def extract_transaction_from_image
      image_base64, mime_type = gemini_image_payload(@image)
      result = gemini.extract_transaction_from_image(image_base64, mime_type: mime_type, context: @text.presence || recent_context_text)
      log_ai_result(result, request_kind: 'transaction_image', model: gemini_extract_model)
      result
    rescue StandardError => e
      { text: "Transaction extraction error: #{e.message}" }
    end

    def extract_transaction_from_message(message_id, context: nil)
      message = ChatMessage.find_by(id: message_id)
      return { text: "I couldn't find that image anymore." } unless message&.image&.attached?

      image_base64, mime_type = gemini_image_payload(message.image)
      result = gemini.extract_transaction_from_image(image_base64, mime_type: mime_type, context: context)
      log_ai_result(result, request_kind: 'transaction_image', model: gemini_extract_model)
      result
    rescue StandardError => e
      { text: "Transaction extraction error: #{e.message}" }
    end

    def extract_urls(text)
      text.to_s.scan(%r{https?://[^\s]+}i).uniq
    end

    def strip_urls(text)
      text.to_s.gsub(%r{https?://[^\s]+}i, '').strip
    end
  end
end
