module ChatHelpers
  module TransactionHandlers
    def handle_create_transaction(image_message_id: nil)
      flow_engine.handle_create(:transaction, image_message_id: image_message_id)
    end

    def handle_search_transaction
      query = extract_transaction_query
      return build_response("I couldn't understand what transactions you're looking for.") if query.key?('error')

      scope = FinancialTransaction.where(hidden: false)
      criteria_desc = []

      if query['merchant'].present?
        term = query['merchant']
        scope = scope.where("merchant_name ILIKE :term OR plaid_name ILIKE :term", term: "%#{term}%")
        criteria_desc << "merchant '#{term}'"
      end

      if query['category'].present?
        scope = scope.where("category ILIKE ?", "%#{query['category']}%")
        criteria_desc << "category '#{query['category']}'"
      end

      if query['start_date'].present?
        date = Date.parse(query['start_date'])
        scope = scope.where("transacted_at >= ?", date.beginning_of_day)
        criteria_desc << "after #{date.strftime('%b %d')}"
      end

      if query['end_date'].present?
        date = Date.parse(query['end_date'])
        scope = scope.where("transacted_at <= ?", date.end_of_day)
        criteria_desc << "before #{date.strftime('%b %d')}"
      end

      if query['min_amount'].present?
        scope = scope.where("amount >= ?", query['min_amount'])
        criteria_desc << "over $#{query['min_amount']}"
      end

      if query['max_amount'].present?
        scope = scope.where("amount <= ?", query['max_amount'])
        criteria_desc << "under $#{query['max_amount']}"
      end

      limit = query['limit'] || 5
      transactions = scope.order(transacted_at: :desc).limit(limit)

      if transactions.empty?
        desc = criteria_desc.any? ? criteria_desc.join(", ") : "all transactions"
        return build_response("I couldn't find any transactions matching: #{desc}.")
      end

      total = scope.sum(:amount)
      formatted = transactions.map { |t| format_transaction_record(t) }.join("\n")

      response_text = "Found #{scope.count} transactions (Total: $#{total})\n\n#{formatted}"
      if scope.count > limit
        response_text += "\n\n(Showing top #{limit})"
      end

      build_response(response_text)
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
        set_pending_action(ChatConstants::PendingAction::CLARIFY_TRANSACTION_FIELDS, pending_payload)
        return build_response(
          clarify_missing_details(
            intent: ChatConstants::Intent::CREATE_TRANSACTION,
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
          action: ChatConstants::FrontendAction::TRANSACTION_CREATED
        )
      end

      build_response(
        "Added #{created_titles.length} transactions. ✅\n#{created_titles.map { |line| "- #{line}" }.join("\n")}",
        action: ChatConstants::FrontendAction::TRANSACTION_CREATED
      )
    end
  end
end
