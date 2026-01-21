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

    def decide_pending_action(pending_action, pending_payload)
      result = gemini.decide_pending_action(
        pending_action: pending_action,
        pending_payload: pending_payload,
        text: @text,
        has_image: image_attached?,
        context: recent_context_text
      )
      log_ai_result(result, request_kind: 'pending_action', model: gemini_intent_model)
      result[:event] || {}
    rescue StandardError => e
      log_ai_error(request_kind: 'pending_action', model: gemini_intent_model, error: e.message)
      {}
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
      return build_response("I couldn't find that image anymore.") unless message&.image&.attached?

      image_base64, mime_type = gemini_image_payload(message.image)
      result = gemini.extract_event_from_image(image_base64, mime_type: mime_type, context: context)
      log_ai_result(result, request_kind: 'image', model: gemini_extract_model)
      result
    rescue StandardError => e
      build_response("Image extraction error: #{e.message}")
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
      return build_response("I couldn't find that image anymore.") unless message&.image&.attached?

      image_base64, mime_type = gemini_image_payload(message.image)
      result = gemini.extract_transaction_from_image(image_base64, mime_type: mime_type, context: context)
      log_ai_result(result, request_kind: 'transaction_image', model: gemini_extract_model)
      result
    rescue StandardError => e
      build_response("Transaction extraction error: #{e.message}")
    end

    def generate_intent_clarification(is_followup: false)
      image_base64 = nil
      mime_type = nil
      if image_attached?
        image_base64, mime_type = gemini_image_payload(@image)
      end
      result = gemini.generate_intent_clarification(
        text: @text,
        has_image: image_attached?,
        context: recent_context_text,
        image_base64: image_base64,
        mime_type: mime_type,
        is_followup: is_followup
      )
      log_ai_result(result, request_kind: 'intent_clarification', model: gemini_intent_model)
      result[:text] || "What would you like me to do?"
    rescue StandardError => e
      log_ai_error(request_kind: 'intent_clarification', model: gemini_intent_model, error: e.message)
      is_followup ? "I'm still not sure. Would you like to add an event, log a transaction, or save a memory?" : "Would you like to add an event, log a transaction, or save a memory?"
    end

    def extract_urls(text)
      text.to_s.scan(%r{https?://[^\s]+}i).uniq
    end

    def strip_urls(text)
      text.to_s.gsub(%r{https?://[^\s]+}i, '').strip
    end
  end
end
