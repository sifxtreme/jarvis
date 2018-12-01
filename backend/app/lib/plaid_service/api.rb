# service to get data via plaid api
module PlaidService
  class Api
    include Balances
    include Transactions

    def initialize
      @client = Plaid::Client.new(env: :development,
                                  client_id: ENV['JARVIS_PLAID_CLIENT_ID'],
                                  secret: ENV['JARVIS_PLAID_CLIENT_SECRET'],
                                  public_key: ENV['JARVIS_PLAID_PUBLIC_KEY'])
      @banks = PlaidBank.all
    end
  end
end
