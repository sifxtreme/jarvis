# get balance info from plaid api
module PlaidService::Balances

  def sync_all_balances(async = false)
    Rails.logger.error('PlaidService::Balances sync_all_balances')

    banks.each do |bank|
      if async
        Rails.logger.info('Enqueuing SyncBalancesForBank')
        Resque.enqueue(SyncBalancesForBank, bank.id)
      else
        sync_balances_for_bank(bank)
      end
    end
  end

  def sync_balances_for_bank(bank)
    Rails.logger.error("SYNC BALANCE BANK: #{bank.name}")

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

  private

  def raw_balance_for_bank(token)
    retries ||= 0
    client.accounts.balance.get(token)
  rescue StandardError => e
    retry if (retries += 1) < 3
    raise StandardError, "ERROR SYNC BALANCE for #{PlaidBank.find_by_token(token).name}: #{e.message}"
  end

end
