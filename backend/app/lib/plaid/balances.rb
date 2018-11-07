module Plaid
  module Balances

    def sync_all_balances
      banks.each do |bank|
        Resque.enqueue(SyncBalance, bank.id)
      end
    end

    def sync_balance_for_bank(bank)
      bank_balances = balance_for_account(bank)
      sync_balance_to_database(bank.name, bank_balances)
    end

    def sync_balance_to_database(bank_name, bank_info)
      bank_info.each do |card_name, card_info|
        pb = PlaidBalance.new
        pb.bank_name = bank_name
        pb.card_name = card_name
        pb.current_balance = card_info[:current_balance]
        pb.pending_balance = card_info[:pending_balance]
        pb.save!
      end
    end

    def balance_for_account(bank)
      balance_response = raw_balance_for_account(bank)

      balance_response["accounts"].map do |x|
        
        card_name = x["meta"]["name"]
        current_balance = x["balance"]["current"]
        card_limit = x["meta"]["limit"]
        available_balance = x["balance"]["available"]

        [
          card_name,
          {
            current_balance: current_balance.round(2),
            pending_balance: (card_limit - available_balance - current_balance).round(2)
          }
        ]

      end.to_h
    end

    def raw_balance_for_account(bank)
      data = {
        client_id: client_id,
        secret: client_secret,
        access_token: bank.token,
      }

      Rails.logger.info "Starting balance API call for #{bank.name}"
      response = RestClient.post("#{plaid_api_url}/balance", data)
      Rails.logger.info "Finished balance API call for #{bank.name}"

      JSON.parse(response.body)
    end

  end
end