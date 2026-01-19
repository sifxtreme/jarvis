module ChatHelpers
  module Payloads
    def merge_pending_payload(payload, image_message_id)
      return payload unless image_message_id

      payload.merge('image_message_id' => image_message_id)
    end

    def extracted_transactions(payload)
      return [] if payload.nil?
      return payload.select { |transaction| transaction.is_a?(Hash) } if payload.is_a?(Array)

      if payload.is_a?(Hash) && payload['transactions'].is_a?(Array)
        return payload['transactions'].select { |transaction| transaction.is_a?(Hash) }
      end

      []
    end

    def extracted_events(payload)
      return [] if payload.nil?
      return payload.select { |event| event.is_a?(Hash) } if payload.is_a?(Array)

      if payload.is_a?(Hash) && payload['events'].is_a?(Array)
        return payload['events'].select { |event| event.is_a?(Hash) }
      end

      []
    end
  end
end
