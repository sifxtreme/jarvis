require 'pry'
require 'rest-client'
require 'json'

require_relative '../../db/models/financial_transaction'
require_relative '../../config/settings'
require_relative '../../log/logger'

require_relative '../analysis/finances'

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

    # lists all of plaids accepted banks/credit cards
    def institutions
      @institutions ||= begin
        response = RestClient.get "#{api_url}/institutions"
        response_json = JSON.parse response.body

        banks = response_json.map do |bank|
          {
              name: bank['name'],
              type: bank['type']
          }
        end

        banks
      end
    end

    # what is the balance on my credit card?
    def balance(type)
      data = {
          client_id: client_id,
          secret: secret,
          access_token: access_tokens[type],
      }

      response = RestClient.post "#{api_url}/balance", data
      response_json = JSON.parse response.body

      response_json['accounts'].map {|x| x['balance']}
    end

    def transactions(type)
      sixty_days_ago = (Date.today - 90)

      data = {
          client_id: client_id,
          secret: secret,
          access_token: access_tokens[type],
          options: {
              gte: sixty_days_ago.to_s
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

    def sync_all
      access_tokens.each do |bank, _|
        next if bank == 'amex'
        sync_to_database(bank)
      end
    end

    def sync_to_database(type)
      begin
        transactions(type).each do |data|
          next if FinancialTransaction.where(plaid_id: data[:id]).any?
          
          f = FinancialTransaction.find_or_initialize_by(plaid_id: data[:id])
          f.transacted_at = data[:date]
          f.plaid_name = data[:name]
          f.amount = data[:amount]
          f.source = data[:type]

          f.spreadsheet_name = analysis.predicted_name(data[:name])
          f.category = analysis.predicted_category(data[:name])
          f.save!
        end

        JarvisLogger.logger.info "Syncing #{transactions(type).count} #{type} transactions from PLAID to DB"

      rescue StandardError => e
        JarvisLogger.logger.error e.message
        JarvisLogger.logger.error type
      end
    end

    def analysis
      Analysis::Finances.new
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