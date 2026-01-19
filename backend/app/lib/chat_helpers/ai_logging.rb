module ChatHelpers
  module AiLogging
    def ai_metadata(response: nil, request: nil, extra: {})
      base_request = request || { text: @text, has_image: image_attached? }
      { request: base_request, response: response, correlation_id: @correlation_id }.merge(extra).compact
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

    def log_ai_result(result, request_kind:, model:, response: nil)
      payload = response || result[:event]
      status = payload.is_a?(Hash) && payload['error'] ? 'error' : 'success'
      log_ai_request(
        @message,
        result[:usage] || {},
        request_kind: request_kind,
        model: model,
        status: status,
        metadata: ai_metadata(response: payload)
      )
    end

    def log_ai_text(text, usage:, request_kind:, model:, response: nil)
      status = text.to_s.empty? ? 'error' : 'success'
      log_ai_request(
        @message,
        usage || {},
        request_kind: request_kind,
        model: model,
        status: status,
        metadata: ai_metadata(response: response || { text: text })
      )
    end

    def log_ai_error(request_kind:, model:, error:)
      log_ai_request(
        @message,
        {},
        request_kind: request_kind,
        model: model,
        status: 'error',
        error_message: error.to_s,
        metadata: ai_metadata
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
  end
end
