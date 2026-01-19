module ChatHelpers
  module TransactionHandlers
    def handle_create_transaction(image_message_id: nil)
      flow_engine.handle_create(:transaction, image_message_id: image_message_id)
    end

    def handle_transaction_extraction_selection(payload)
      transactions = extracted_transactions(payload['transactions'])
      if transactions.empty?
        return build_response("Reply with the transaction numbers to add, or say \"all\".")
      end

      indices = selection_indices_from_text(transactions.length)
      if indices.nil?
        return build_response("Reply with the transaction numbers to add, or say \"all\".")
      end

      if indices == :all
        selected = transactions
      elsif indices.empty?
        return build_response("Reply with the transaction numbers to add, or say \"all\".")
      else
        selected = indices.map { |idx| transactions[idx] }.compact
      end

      if (missing_entry = selected.find { |transaction| missing_transaction_fields(transaction).any? })
        missing = missing_transaction_fields(missing_entry)
        pending_payload = { 'transaction' => missing_entry, 'missing_fields' => missing }
        pending_payload = merge_pending_payload(pending_payload, payload['image_message_id'])
        set_pending_action('clarify_transaction_fields', pending_payload)
        return build_response(
          clarify_missing_details(
            intent: 'create_transaction',
            missing_fields: missing,
            extracted: missing_entry,
            extra: "Valid sources: #{TransactionSources.prompt_list}",
            fallback: "I need #{missing.join(', ')} to add this transaction."
          )
        )
      end

      results = selected.map { |transaction| create_transaction(transaction) }
      created_titles = selected.map { |transaction| format_transaction(transaction) }
      errors = results.select { |result| result.is_a?(Hash) && result[:error_code].present? }.map { |result| result[:text] }.compact

      clear_thread_state
      if errors.any?
        return build_response(
          "Added #{created_titles.length - errors.length} transactions. Some failed:\n#{errors.map { |err| "- #{err}" }.join("\n")}",
          action: 'transaction_created'
        )
      end

      build_response(
        "Added #{created_titles.length} transactions. ✅\n#{created_titles.map { |line| "- #{line}" }.join("\n")}",
        action: 'transaction_created'
      )
    end
  end
end
