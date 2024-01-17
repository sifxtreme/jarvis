class PlaidService::API

  def client
    @client = Plaid::Client.new(
      env: :development,
      client_id: ENV.fetch('JARVIS_PLAID_CLIENT_ID', nil),
      secret: ENV.fetch('JARVIS_PLAID_CLIENT_SECRET', nil),
      public_key: ENV.fetch('JARVIS_PLAID_PUBLIC_KEY', nil)
    )
  end

  def banks
    @banks = PlaidBank.where(is_active: true)
  end

  def sync_all_transactions
    banks.each do |bank|
      sync_transactions_for_bank(bank)
    end
  end

  def sync_transactions_for_bank(bank)
    account_transactions = transactions_for_account(bank)
    sync_transactions_to_database(bank, account_transactions)
  end

  def sync_transactions_to_database(bank, account_transactions)
    filtered_transactions = account_transactions.reject do |data|
      FinancialTransaction.where(plaid_id: data[:id]).any?
    end

    filtered_transactions.each do |data|
      f = FinancialTransaction.find_or_initialize_by(plaid_id: data[:id])

      f.transacted_at = data[:date]
      f.plaid_name = data[:name]
      f.amount = data[:amount]
      f.source = data[:bank]
      f.raw_data = data[:raw_data]

      f.save!
    end
  rescue StandardError => e
    Rails.logger.error("ERROR SYNC TRANSACTIONS: #{bank.name}")
    Rails.logger.error(e.message)
  end

  def transactions_for_account(bank)
    response_json = raw_transactions_for_account(bank.token)

    raw_transactions = response_json['transactions']

    # reject payments and pending transactions and mom's transactions
    transactions = raw_transactions.reject do |trx|
      transaction_is_payment?(trx) || trx['pending'] || trx['account_owner'].include?('JAMEELA')
    end

    transactions.map do |trx|
      {
        id: trx['transaction_id'],
        date: trx['date'],
        name: trx['name'],
        amount: trx['amount'],
        raw_data: trx,
        bank: bank.name
      }
    end
  end

  private

  def raw_transactions_for_account(token)
    retries ||= 0
    client.transactions.get(token, 1.month.ago.strftime('%Y-%m-%d'), Date.today.strftime('%Y-%m-%d'))
  rescue StandardError => e
    retry if (retries += 1) < 3
    raise StandardError, "ERROR SYNC TRANSACTIONS for #{PlaidBank.find_by_token(token).name}: #{e.message}"
  end

  def transaction_is_payment?(transaction)
    name = transaction['name'].downcase
    name.include?('payment') || name.include?('pymt')
  end

end
