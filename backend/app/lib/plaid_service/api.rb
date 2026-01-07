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
    @banks = BankConnection.active.plaid
  end

  def sync_all_transactions
    banks.each do |bank|
      sync_transactions_for_bank(bank)
    end
  end

  def sync_transactions_for_bank(bank)
    started_at = Time.current
    status = 'success'
    error = nil
    fetched_count = 0
    filtered_count = 0
    inserted_count = 0
    updated_count = 0
    latest_transaction_date = nil

    begin
      raw_response = raw_transactions_for_account(bank.token)
      raw_transactions = raw_response_transactions(raw_response)
      fetched_count = raw_transactions.length

      account_transactions = map_transactions(raw_transactions, bank)
      filtered_count = account_transactions.length
      latest_transaction_date = account_transactions.map { |t| Date.parse(t[:date]) }.max

      counts = sync_transactions_to_database(bank, account_transactions)
      inserted_count = counts[:inserted]
      updated_count = counts[:updated]
    rescue StandardError => e
      status = 'error'
      error = e.message
      Rails.logger.error("ERROR SYNC TRANSACTIONS: #{bank.name}")
      Rails.logger.error(e.message)
    ensure
      BankSyncLog.create!(
        bank_connection: bank,
        provider: bank.provider || 'plaid',
        status: status,
        error: error,
        fetched_count: fetched_count,
        filtered_count: filtered_count,
        inserted_count: inserted_count,
        updated_count: updated_count,
        latest_transaction_date: latest_transaction_date,
        started_at: started_at,
        finished_at: Time.current
      )
    end
  end

  def sync_transactions_to_database(bank, account_transactions)
    filtered_transactions = account_transactions.reject do |data|
      FinancialTransaction.where(plaid_id: data[:id]).any?
    end

    filtered_transactions.each do |data|
      f = FinancialTransaction.find_or_initialize_by(plaid_id: data[:id])

      if f.new_record?
        inserted += 1
      else
        updated += 1
      end

      f.transacted_at = data[:date]
      f.plaid_name = data[:name]
      f.amount = data[:amount]
      f.source = data[:bank]
      f.raw_data = data[:raw_data]

      f.save!
    end
    { inserted: inserted, updated: updated }
  rescue StandardError => e
    Rails.logger.error("ERROR SYNC TRANSACTIONS: #{bank.name}")
    Rails.logger.error(e.message)
    { inserted: 0, updated: 0 }
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

  def raw_response_transactions(response)
    response.is_a?(Hash) ? Array(response['transactions']) : Array(response.transactions)
  rescue StandardError
    []
  end

  def map_transactions(raw_transactions, bank)
    transactions = raw_transactions.reject do |trx|
      transaction_is_payment?(trx) || trx['pending'] || trx['account_owner'].to_s.include?('JAMEELA')
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
