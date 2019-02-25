module PlaidService
  module Transactions

    def sync_all_transactions(async = false)
      banks.each do |bank|
        if async
          Resque.enqueue(SyncTransactionsForBank, bank.id)
        else
          sync_transactions_for_bank(bank)
        end
      end
    end

    def sync_transactions_for_bank(bank)
      Rails.logger.info("SYNC TRANSACTION BANK: #{bank.name}")
      account_transactions = transactions_for_account(bank)

      sync_transactions_to_database(bank, account_transactions)
    end

    def sync_transactions_to_database(bank, account_transactions)
      filtered_transactions = account_transactions.reject do |data|
        FinancialTransaction.where(plaid_id: data[:id]).any? ||
          FinancialTransaction.where(
            plaid_name: data[:name],
            transacted_at: data[:date]
          ).any?
      end

      filtered_transactions.each do |data|
        f = FinancialTransaction.find_or_initialize_by(plaid_id: data[:id])

        f.transacted_at = data[:date]
        f.plaid_name = data[:name]
        f.amount = data[:amount]
        f.source = data[:bank]

        f.save!
      end
    rescue StandardError => e
      Rails.logger.error("ERROR SYNC TRANSACTIONS: #{bank.name}")
      Rails.logger.error(e.message)
    end

    def transactions_for_account(bank)
      response_json = raw_transactions_for_account(bank.token)

      raw_transactions = response_json['transactions']

      # reject payments and pending transactions
      transactions = raw_transactions.reject do |trx|
        transaction_is_payment?(trx) || trx['pending']
      end

      transactions.map do |transaction|
        {
          id: transaction['transaction_id'],
          date: transaction['date'],
          name: transaction['name'],
          amount: transaction['amount'],
          bank: bank.name
        }
      end
    end

    private

    def raw_transactions_for_account(token)
      retries ||= 0
      client.transactions.get(token, 1.month.ago.strftime('%Y-%m-%d'), Date.today.strftime('%Y-%m-%d'))
    rescue StandardError => e
      Rails.logger.error("ERROR SYNC TRANSACTIONS BANK: #{bank.name}")
      Rails.logger.error(e.message)
      retry if (retries += 1) < 3
    end

    def transaction_is_payment?(transaction)
      name = transaction['name'].downcase
      name.include?('payment') || name.include?('pymt')
    end

  end
end
