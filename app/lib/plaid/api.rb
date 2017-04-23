require 'pry'
require 'rest-client'
require 'json'

require_relative '../../db/models/financial_transaction'
require_relative '../../config/settings'
require_relative '../../log/logger'

module Plaid
  class Api

    PLAID_API_URL = 'https://tartan.plaid.com'

    attr_accessor :api_url
    attr_accessor :client_id
    attr_accessor :secret

    def initialize
      @api_url = PLAID_API_URL
      @client_id = Settings.plaid_api['client_id']
      @secret = Settings.plaid_api['client_secret']
    end

    def sync_all
      access_tokens.each do |bank, _|
        next if bank == 'amex'
        sync_to_database(bank)
      end
    end

    def sync_to_database(type)
      begin
        transactions = get_transactions_for_account(type)

        count = 0
        
        transactions.each do |data|
          next if FinancialTransaction.where(plaid_id: data[:id]).any?

          count += 1
          
          f = FinancialTransaction.find_or_initialize_by(plaid_id: data[:id])
          f.transacted_at = data[:date]
          f.plaid_name = data[:name]
          f.amount = data[:amount]
          f.source = data[:type]

          f.save!
        end

        JarvisLogger.logger.info "Syncing #{count} #{type} transactions from PLAID to DB"

      rescue StandardError => e
        JarvisLogger.logger.error e.message
        JarvisLogger.logger.error type
      end
    end

    def get_transactions_for_account(type)
      time_period = (Date.today - 90)

      data = {
          client_id: client_id,
          secret: secret,
          access_token: access_tokens[type],
          options: {
              gte: time_period.to_s
          }
      }

      response = RestClient.post "#{api_url}/connect/get", data
      response_json = JSON.parse response.body

      raw_transactions = response_json['transactions']

      transactions = raw_transactions.select do |transaction|
        true unless transaction_is_payment?(transaction)
      end.map do |transaction|
        {
            id: transaction['_id'],
            date: transaction['date'],
            name: transaction['name'],
            amount: transaction['amount'],
            type: type
        }
      end

      transactions
    end

    private

    def access_tokens
      Settings.plaid_access_tokens
    end

    def transaction_is_payment?(transaction)
      name = transaction['name'].downcase
      name.include?('payment') || name.include?('pymt')
    end

  end
end