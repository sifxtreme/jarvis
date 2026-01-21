require 'chat_constants'

module ChatFlows
  class Transaction < Base
    def kind
      :transaction
    end

    def intent
      ChatConstants::Intent::CREATE_TRANSACTION
    end

    def plural_label
      'transactions'
    end

    def singular_label
      'transaction'
    end

    def payload_key
      'transaction'
    end

    def extract(image_message_id: nil)
      if image_message_id
        handler.extract_transaction_from_message(image_message_id, context: handler.text_context)
      elsif handler.image_attached?
        handler.extract_transaction_from_image
      else
        handler.extract_transaction_from_text
      end
    end

    def missing_fields(payload)
      handler.missing_transaction_fields(payload)
    end

    def error_missing_fields
      ['merchant', 'amount', 'date', 'source']
    end

    def error_fallback
      'What is the merchant, amount, date, and source?'
    end

    def confirm_prompt(payload, stage: :initial)
      base = stage == :corrected ? 'Got it. I’m ready to add this transaction:' : 'I’m ready to add this transaction:'
      "#{base}\n\n#{handler.format_transaction(payload)}\n\nShould I add it?"
    end

    def execute(payload)
      handler.create_transaction(payload)
    end

    def multi_items(payload)
      handler.extracted_transactions(payload)
    end

    def multi_formatter(items)
      handler.format_extracted_transactions(items)
    end

    def multi_action
      ChatConstants::PendingAction::SELECT_TRANSACTION_FROM_EXTRACTION
    end

    def multi_payload_key
      'transactions'
    end

    def clarify_action
      ChatConstants::PendingAction::CLARIFY_TRANSACTION_FIELDS
    end

    def confirm_action
      ChatConstants::PendingAction::CONFIRM_TRANSACTION
    end

    def allow_multi_on_correction?
      true
    end

    def extra_prompt(_stage:, _payload:, _missing_fields:)
      "Valid sources: #{TransactionSources.prompt_list}"
    end
  end
end
