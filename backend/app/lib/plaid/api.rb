module Plaid
  class Api

    include Transactions
    include Balances

    PLAID_API_URL = 'https://tartan.plaid.com'

    attr_accessor :api_url
    attr_accessor :client_id
    attr_accessor :secret
    attr_accessor :banks

    def initialize
      @api_url = PLAID_API_URL
      @client_id = ENV['JARVIS_PLAID_CLIENT_ID']
      @secret = ENV['JARVIS_PLAID_CLIENT_SECRET']
      @banks = PlaidBank.all
    end

  end
end