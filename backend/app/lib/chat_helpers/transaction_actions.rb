module ChatHelpers
  module TransactionActions
    def create_transaction(transaction)
      if transaction['error']
        log_action(@message, calendar_event_id: nil, calendar_id: nil, status: ChatConstants::Status::ERROR, action_type: ChatConstants::ActionType::CREATE_TRANSACTION, metadata: { error: transaction['message'] })
        return build_response(transaction['message'] || "I couldn't find a transaction.")
      end

      record = FinancialTransaction.create!(
        plaid_id: nil,
        plaid_name: transaction['merchant'],
        merchant_name: transaction['merchant'],
        category: transaction['category'],
        amount: transaction['amount'].to_f,
        transacted_at: parse_transaction_date(transaction['date']),
        source: normalize_source(transaction['source']),
        hidden: false,
        reviewed: true
      )

      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: ChatConstants::Status::SUCCESS, action_type: ChatConstants::ActionType::CREATE_TRANSACTION, metadata: { transaction_id: record.id })

      build_response("Added the transaction. ✅", action: ChatConstants::FrontendAction::TRANSACTION_CREATED)
    rescue StandardError => e
      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: ChatConstants::Status::ERROR, action_type: ChatConstants::ActionType::CREATE_TRANSACTION, metadata: { error: e.message })
      build_response("Transaction error: #{e.message}")
    end
  end
end
