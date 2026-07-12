require 'net/http'
require 'openssl'
require 'json'
require 'uri'
require 'date'

class Plaid::API

  class PlaidError < StandardError; end

  def initialize
    @client_id = ENV['PLAID_CLIENT_ID']
    @secret = ENV['PLAID_SECRET']
    @base_url = "https://#{ENV.fetch('PLAID_ENV', 'production')}.plaid.com"
  end

  # Sync transactions for all active Plaid bank connections
  def sync_all_transactions
    banks.each do |bank|
      sync_transactions_for_bank(bank)
    end
  end

  # Sync transactions for a specific bank connection.
  # Paginates /transactions/sync on next_cursor until has_more == false,
  # then persists the final cursor so the next run is incremental. A null
  # cursor on the first run pulls the full history (backfill).
  def sync_transactions_for_bank(bank)
    Rails.logger.info "[Plaid] Syncing transactions for #{bank.name}"

    started_at = Time.current
    status = 'success'
    error = nil
    fetched_count = 0
    filtered_count = 0
    inserted_count = 0
    updated_count = 0
    latest_transaction_date = nil

    begin
      added = []
      modified = []
      removed = []
      cursor = bank.transactions_cursor

      loop do
        body = { access_token: bank.token }
        body[:cursor] = cursor if cursor.present?
        page = post('/transactions/sync', body)

        added.concat(page['added'] || [])
        modified.concat(page['modified'] || [])
        removed.concat(page['removed'] || [])
        cursor = page['next_cursor']

        break unless page['has_more']
      end

      upserts = added + modified
      fetched_count = upserts.size + removed.size

      # Only ingest POSTED transactions AFTER the cutoff.
      # - pending: a pending row gets a different transaction_id once it posts,
      #   so filtering keeps plaid_id stable.
      # - sync_from_date: Teller and Plaid assign DIFFERENT transaction_ids, so
      #   find_or_initialize_by(plaid_id) can't dedupe across them. Without this
      #   cutoff, Plaid's ~24-month backfill would re-insert every Amex txn Teller
      #   already synced as duplicate rows. Mirrors Teller::API's sync_from_date
      #   filter — ingest strictly after the date Teller last covered.
      posted = upserts.reject do |trx|
        trx['pending'] == true ||
          (bank.sync_from_date.present? && Date.parse(trx['date']) <= bank.sync_from_date)
      end
      filtered_count = posted.count
      Rails.logger.info "[Plaid] Found #{posted.count} posted transactions for #{bank.name}"

      posted.each do |trx|
        f = FinancialTransaction.find_or_initialize_by(plaid_id: trx['transaction_id'])

        next if f.reviewed?

        latest_transaction_date = [latest_transaction_date, Date.parse(trx['date'])].compact.max
        if f.new_record?
          inserted_count += 1
        else
          updated_count += 1
        end

        f.transacted_at = trx['date']
        # plaid_name = the RAW bank descriptor, always. This column has always meant
        # "what the bank actually sent" (Teller stored "AMAZON MARKETPLACE
        # NAMZN.COM/BILL WA" here). Storing Plaid's *cleaned* merchant_name here
        # instead destroyed the audit trail and hid the raw string from the UI.
        # The clean name belongs in merchant_name — the predictor sets it from
        # raw_data['merchant_name'].
        f.plaid_name = trx['name'].presence || trx['merchant_name']
        f.amount = trx['amount'].to_f
        f.source = bank.name
        f.raw_data = trx

        f.save!
      end

      # Plaid-removed transactions: hide them, don't destroy.
      removed.each do |trx|
        removed_id = trx.is_a?(Hash) ? trx['transaction_id'] : trx
        next if removed_id.blank?

        FinancialTransaction.where(plaid_id: removed_id).update_all(hidden: true)
      end

      bank.update!(transactions_cursor: cursor)

      Rails.logger.info "[Plaid] Finished syncing #{bank.name}"
    rescue PlaidError => e
      status = 'error'
      error = e.message
      Rails.logger.error "[Plaid] Error syncing #{bank.name}: #{e.message}"
    rescue StandardError => e
      status = 'error'
      error = e.message
      Rails.logger.error "[Plaid] Error syncing #{bank.name}: #{e.message}"
    ensure
      BankSyncLog.create!(
        bank_connection: bank,
        provider: 'plaid',
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
      # Continue with other banks even if one fails
    end
  end

  # List all accounts for a given access token
  # Useful for discovering account_ids when setting up new bank connections
  def list_accounts(access_token)
    post('/accounts/get', { access_token: access_token })
  end

  # Create a short-lived link_token used to initialize Plaid Link in the browser
  def create_link_token(user_id)
    post('/link/token/create', {
      client_name: 'Jarvis',
      language: 'en',
      country_codes: ['US'],
      user: { client_user_id: user_id.to_s },
      products: ['transactions']
    })
  end

  # Exchange a public_token (from Link onSuccess) for a permanent access_token
  def exchange_public_token(public_token)
    post('/item/public_token/exchange', { public_token: public_token })
  end

  private

  # Get all active Plaid bank connections
  def banks
    BankConnection.active.plaid
  end

  # POST helper — every request injects client_id + secret, parses JSON, and
  # raises PlaidError on non-2xx (mirrors Teller::API#fetch_transactions,
  # minus the mTLS cert/key which Plaid does not use).
  def post(path, body)
    uri = URI("#{@base_url}#{path}")

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_PEER

    request = Net::HTTP::Post.new(uri.request_uri)
    request['Content-Type'] = 'application/json'
    request.body = body.merge(client_id: @client_id, secret: @secret).to_json

    response = http.request(request)

    raise PlaidError, "Error: #{response.body}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

end
