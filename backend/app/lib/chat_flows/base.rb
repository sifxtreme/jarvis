module ChatFlows
  class Base
    attr_reader :handler

    def initialize(handler)
      @handler = handler
    end

    def kind
      raise NotImplementedError
    end

    def intent
      raise NotImplementedError
    end

    def plural_label
      raise NotImplementedError
    end

    def singular_label
      raise NotImplementedError
    end

    def payload_key
      raise NotImplementedError
    end

    def extract(_image_message_id: nil)
      raise NotImplementedError
    end

    def normalize(payload)
      payload
    end

    def missing_fields(_payload)
      []
    end

    def error_missing_fields
      []
    end

    def error_fallback
      nil
    end

    def missing_fallback(_missing_fields, _payload)
      nil
    end

    def correction_fallback(_missing_fields, _payload)
      nil
    end

    def confirm_prompt(_payload, stage: :initial)
      raise NotImplementedError
    end

    def execute(payload)
      raise NotImplementedError
    end

    def preflight
      nil
    end

    def multi_items(_payload)
      []
    end

    def multi_formatter(_items)
      nil
    end

    def multi_action
      nil
    end

    def multi_payload_key
      nil
    end

    def clarify_action
      raise NotImplementedError
    end

    def confirm_action
      raise NotImplementedError
    end

    def allow_multi_on_correction?
      false
    end

    def extra_prompt(_stage:, _payload:, _missing_fields:)
      nil
    end

    def pending_adjuster(payload:, extracted:, missing_fields:, stage:)
      payload
    end
  end
end
