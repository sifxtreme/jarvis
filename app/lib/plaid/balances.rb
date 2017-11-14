module Plaid
  module Balances

    def balances
      banks.map {|bank| [bank.name, balance_for_account(bank)]}.to_h
    end

    def balance_for_account(bank)
      balance_response = raw_balance_for_account(bank)

      balance_response["accounts"].map do |x|
        [
          x["meta"]["name"],
          {
            current_balance: x["balance"]["current"].round(2),
            corrected_balance: (x["meta"]["limit"] - x["balance"]["available"]).round(2)
          }
        ]
      end.to_h
    end

    def raw_balance_for_account(bank)
      data = {
        client_id: client_id,
        secret: secret,
        access_token: bank.token,
      }

      response = RestClient.post("#{api_url}/balance", data)
      JSON.parse(response.body)
    end

  end
end