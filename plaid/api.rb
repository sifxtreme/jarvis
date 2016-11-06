require 'pry'
require 'rest-client'
require 'json'

require_relative './settings'

module Plaid

  class Api

    ENDPOINT = 'https://tartan.plaid.com'
    DATABASE_API_BASE_URL = 'http://localhost:3000'
    DATABASE_API_UPLOAD_URL = "#{DATABASE_API_BASE_URL}/transactions/batch_upload"

    attr_accessor :endpoint
    attr_accessor :client_id
    attr_accessor :secret

    def initialize
      @endpoint = ENDPOINT
      @client_id = Settings.plaid['client_id']
      @secret = Settings.plaid['client_secret']
    end

    def institutions
      @institutions ||= begin
        response = RestClient.get "#{endpoint}/institutions"
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

    def balance(type)
      data = {
          client_id: client_id,
          secret: secret,
          access_token: access_tokens[type],
      }

      response = RestClient.post "#{endpoint}/balance", data
      response_json = JSON.parse response.body

      response_json['accounts'].first['balance']
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

      response = RestClient.post "#{endpoint}/connect/get", data
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
        bank_transactions = transactions(type)
        data = {transactions: bank_transactions}
        headers = {content_type: :json, accept: :json}
        RestClient.post DATABASE_API_UPLOAD_URL, data.to_json, headers
      rescue StandardError => e
        print e.message
        print type
      end
    end

    private

    def access_tokens
      Settings.access_tokens
    end

    def transaction_is_payment?(transaction)
      name = transaction['name'].downcase
      name.include?('payment') || name.include?('pymt')
    end

  end
end