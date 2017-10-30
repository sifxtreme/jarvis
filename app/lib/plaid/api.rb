module Plaid
  class Api

    PLAID_API_URL = 'https://tartan.plaid.com'

    attr_accessor :api_url
    attr_accessor :client_id
    attr_accessor :secret

    def initialize
      @api_url = PLAID_API_URL
      @client_id = ENV['JARVIS_PLAID_CLIENT_ID']
      @secret = ENV['JARVIS_PLAID_CLIENT_SECRET']
    end

    def sync_all
      access_tokens.each do |bank, _|
        sync_to_database(bank)
      end
    end

    def sync_to_database(bank)
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
        Rails.logger.error(bank)
      end
    end

    def transactions_for_account(bank)
      response_json = raw_transactions_for_account(bank)

      raw_transactions = response_json['transactions']

      transactions = raw_transactions.select do |transaction|
        true unless transaction_is_payment?(transaction)
      end

      transactions.map do |transaction|
        {
          id: transaction['_id'],
          date: transaction['date'],
          name: transaction['name'],
          amount: transaction['amount'],
          bank: bank
        }
      end
    end

    def raw_transactions_for_account(bank)
      data = {
        client_id: client_id,
        secret: secret,
        access_token: access_tokens[bank],
        options: {
          gte: (Date.today - 90).to_s # don't go to far back in time
        }
      }

      response = RestClient.post("#{api_url}/connect/get", data)
      JSON.parse(response.body)
    end

    def all_balances
      balances = access_tokens.map {|bank,_| [bank, balance_for_account(bank)]}.to_h
      balances[:total] = balances.values.inject(0) {|sum, x| sum + x[:corrected_balance]}.round(2)
      balances
    end

    def balance_for_account(bank)
      begin
        balance_response = raw_balance_for_account(bank)

        current_balances = balance_response["accounts"].map {|x| x["balance"]["current"]}
        current_balance = current_balances.inject(0) {|sum, x| sum + (x || 0)} || 0

        available_balances = balance_response["accounts"].map {|x| x["balance"]["available"]}
        available_balance = available_balances.inject(0) {|sum, x| sum + (x || 0)} || 0
        
        limits = balance_response["accounts"].map {|x| x["meta"]["limit"]}
        limit = limits.inject(0) {|sum, x| sum + (x || 0)} || 0

        {
          current_balance: current_balance.round(2),
          corrected_balance: (limit - available_balance).round(2),
        }

      rescue => e
        puts e.message
        {
          current_balance: 0,
          corrected_balance: 0,
        }
      end
    end

    def raw_balance_for_account(bank)
      data = {
        client_id: client_id,
        secret: secret,
        access_token: access_tokens[bank],
      }

      response = RestClient.post("#{api_url}/balance", data)
      JSON.parse(response.body)
    end

    private

    def access_tokens
      @access_tokens ||= JSON.parse(ENV["JARVIS_PLAID_ACCESS_TOKENS"])
    end

    def transaction_is_payment?(transaction)
      name = transaction['name'].downcase
      name.include?('payment') || name.include?('pymt')
    end

  end
end