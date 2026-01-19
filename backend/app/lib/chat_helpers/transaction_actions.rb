module ChatHelpers
  module TransactionActions
    def create_transaction(transaction)
      if transaction['error']
        log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'error', action_type: 'create_transaction', metadata: { error: transaction['message'] })
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

      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'success', action_type: 'create_transaction', metadata: { transaction_id: record.id })

      build_response("Added the transaction. ✅", action: 'transaction_created')
    rescue StandardError => e
      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: 'error', action_type: 'create_transaction', metadata: { error: e.message })
      build_response("Transaction error: #{e.message}")
    end
  end
end
