# get balance info from plaid api
module PlaidService
  module Balances

    def sync_all_balances(async = false)
      banks.each do |bank|
        if async
          Resque.enqueue(SyncBalance, bank.id)
        else
          sync_balance_for_bank(bank)
        end
      end
    end

    def sync_balance_for_bank(bank)
      Rails.logger.info("SYNC BALANCE BANK: #{bank.name}")
      account_balances = balance_for_account(bank)
      sync_balance_to_database(bank.name, account_balances)
    end

    def sync_balance_to_database(bank_name, account_balances)
      account_balances.each do |card_name, card_info|
        PlaidBalance.create!(
          bank_name: bank_name,
          card_name: card_name,
          current_balance: card_info[:current_balance],
          pending_balance: card_info[:pending_balance]
        )
      end
    end

    def balance_for_account(bank)
      raw_balance_for_bank(bank.token).accounts.map do |x|
        card_name = x.official_name || x.name
        current_balance = x.balances.current
        card_limit = x.balances.limit
        available_balance = x.balances.available
        pending_balance = card_limit - available_balance - current_balance

        [
          card_name,
          {
            current_balance: current_balance.round(2),
            pending_balance: pending_balance.round(2)
          }
        ]
      end.to_h
    end

    def raw_balance_for_bank(token)
      retries ||= 0
      client.accounts.balance.get(token)
    rescue StandardError => e
      Rails.logger.error("ERROR SYNC BALANCE BANK: #{bank.name}")
      Rails.logger.error(e.message)
      retry if (retries += 1) < 3
    end

  end
end
