require 'chat_flows/registry'

class ChatFlowEngine
  def initialize(handler)
    @handler = handler
    @registry = ChatFlows::Registry.new(handler)
  end

  def handle_create(kind, image_message_id: nil)
    flow = @registry.fetch(kind)
    image_message_id = resolve_image_message_id(image_message_id)

    if (preflight = flow.preflight)
      return flow.execute(preflight[:payload]) if preflight[:action] == :execute
      return preflight[:result] if preflight[:action] == :return
    end

    result = flow.extract(_image_message_id: image_message_id)
    return result if result.is_a?(Hash) && result[:text]

    payload = result[:event] || {}
    items = flow.multi_items(payload)
    if items.any? && flow.multi_action
      pending_payload = merge_pending_payload({ flow.multi_payload_key => items }, image_message_id)
      @handler.set_pending_action(flow.multi_action, pending_payload)
      return @handler.build_response(
        "I found multiple #{flow.plural_label}. Reply with the numbers to add (e.g., 1,2) or say \"all\":\n#{flow.multi_formatter(items)}"
      )
    end

    if payload['error']
      missing = flow.error_missing_fields
      return build_missing_prompt(flow, payload, missing, payload['message'].presence || flow.error_fallback, :error, image_message_id)
    end

    payload = flow.normalize(payload)
    missing = flow.missing_fields(payload)
    confidence = @handler.normalize_confidence(payload['confidence'])

    if missing.any?
      fallback = flow.missing_fallback(missing, payload) || "I need #{missing.join(', ')} to add this #{flow.singular_label}."
      return build_missing_prompt(flow, payload, missing, fallback, :missing, image_message_id)
    end

    if confidence != 'high'
      pending_payload = merge_pending_payload({ flow.payload_key => payload }, image_message_id)
      @handler.set_pending_action(flow.confirm_action, pending_payload)
      return @handler.build_response(flow.confirm_prompt(payload, stage: :initial))
    end

    flow.execute(payload)
  end

  def handle_correction(kind, payload, image_message_id: nil)
    flow = @registry.fetch(kind)
    items = flow.multi_items(payload)
    if flow.allow_multi_on_correction? && items.any? && flow.multi_action
      pending_payload = merge_pending_payload({ flow.multi_payload_key => items }, image_message_id)
      @handler.set_pending_action(flow.multi_action, pending_payload)
      return @handler.build_response(
        "I found multiple #{flow.plural_label}. Reply with the numbers to add (e.g., 1,2) or say \"all\":\n#{flow.multi_formatter(items)}"
      )
    end

    payload = flow.normalize(payload)
    missing = flow.missing_fields(payload)
    confidence = @handler.normalize_confidence(payload['confidence'])

    if missing.any?
      fallback = flow.correction_fallback(missing, payload) || "I still need #{missing.join(', ')}."
      return build_missing_prompt(flow, payload, missing, fallback, :corrected, image_message_id)
    end

    if confidence != 'high'
      pending_payload = merge_pending_payload({ flow.payload_key => payload }, image_message_id)
      @handler.set_pending_action(flow.confirm_action, pending_payload)
      return @handler.build_response(flow.confirm_prompt(payload, stage: :corrected))
    end

    flow.execute(payload)
  end

  private

  def build_missing_prompt(flow, payload, missing_fields, fallback, stage, image_message_id)
    pending_payload = { flow.payload_key => payload }
    pending_payload['missing_fields'] = missing_fields if missing_fields.any?
    pending_payload = flow.pending_adjuster(payload: pending_payload, extracted: payload, missing_fields: missing_fields, stage: stage)
    pending_payload = merge_pending_payload(pending_payload, image_message_id)
    @handler.set_pending_action(flow.clarify_action, pending_payload)
    @handler.build_response(
      @handler.clarify_missing_details(
        intent: flow.intent,
        missing_fields: missing_fields,
        extracted: payload,
        extra: flow.extra_prompt(stage: stage, payload: payload, missing_fields: missing_fields),
        fallback: fallback
      )
    )
  end

  def resolve_image_message_id(image_message_id)
    return image_message_id if image_message_id
    return @handler.message.id if @handler.image_attached?

    nil
  end

  def merge_pending_payload(payload, image_message_id)
    return payload unless image_message_id

    payload.merge('image_message_id' => image_message_id)
  end
end
