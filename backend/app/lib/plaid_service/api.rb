# service to get data via plaid api
class PlaidService::API

  include Balances
  include Transactions

  def client
    @client = Plaid::Client.new(
      env: :development,
      client_id: ENV['JARVIS_PLAID_CLIENT_ID'],
      secret: ENV['JARVIS_PLAID_CLIENT_SECRET'],
      public_key: ENV['JARVIS_PLAID_PUBLIC_KEY']
    )
  end

  def banks
    @banks = PlaidBank.all
  end

end
