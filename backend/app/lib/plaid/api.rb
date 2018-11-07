module Plaid
  class Api

    include Transactions
    include Balances

    def banks
      @banks ||= PlaidBank.all
    end

    def client_id
      @client_id ||= ENV['JARVIS_PLAID_CLIENT_ID']
    end

    def client_secret
      @client_secret ||= ENV['JARVIS_PLAID_CLIENT_SECRET']
    end

    def plaid_api_url
      'https://tartan.plaid.com'
    end


  end
end