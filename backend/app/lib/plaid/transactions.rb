module Plaid
  module Transactions

    def sync_all_transactions
      banks.each do |bank|
        sync_transactions_to_database(bank)
      end
    end

    def sync_transactions_to_database(bank)
      begin
        transactions = transactions_for_account(bank)

        filtered_transactions = transactions.reject do |data|
          FinancialTransaction.where(plaid_id: data[:id]).any?
        end
        
        filtered_transactions.each do |data|
          f = FinancialTransaction.find_or_initialize_by(plaid_id: data[:id])

          f.transacted_at = data[:date]
          f.plaid_name = data[:name]
          f.amount = data[:amount]
          f.source = data[:bank]

          f.save!
        end
      rescue => e
        Rails.logger.error(e.message)
        Rails.logger.error(bank.name)
      end
    end

    def transactions_for_account(bank)
      response_json = raw_transactions_for_account(bank)

      raw_transactions = response_json['transactions']

      transactions = raw_transactions.reject {|trx| transaction_is_payment?(trx)}

      transactions.map do |transaction|
        {
          id: transaction['_id'],
          date: transaction['date'],
          name: transaction['name'],
          amount: transaction['amount'],
          bank: bank.name
        }
      end
    end

    def raw_transactions_for_account(bank)
      data = {
        client_id: client_id,
        secret: client_secret,
        access_token: bank.token,
        options: {
          gte: (Date.today - 90).to_s # don't go to far back in time
        }
      }

      response = RestClient.post("#{plaid_api_url}/connect/get", data)
      JSON.parse(response.body)
    end

    def transaction_is_payment?(transaction)
      name = transaction['name'].downcase
      name.include?('payment') || name.include?('pymt')
    end

  end
end