require 'httparty'
require 'openssl'
require 'base64'
require 'net/http'
require 'date'

class Teller::API

  class TellerError < StandardError; end

  def initialize
    cert_path = Rails.root.join('app/lib/teller/certificate.pem')
    key_path = Rails.root.join('app/lib/teller/private_key.pem')

    @cert = OpenSSL::X509::Certificate.new(File.read(cert_path))
    @key = OpenSSL::PKey::RSA.new(File.read(key_path))
  end

  # List all accounts for a given access token
  # Useful for discovering account_ids when setting up new bank connections
  def list_accounts(token)
    url = "https://api.teller.io/accounts"
    uri = URI(url)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_PEER
    http.cert = @cert
    http.key = @key

    request = Net::HTTP::Get.new(uri.request_uri)
    request['Authorization'] = "Basic #{Base64.strict_encode64(token + ':')}"

    response = http.request(request)

    raise TellerError, "Error: #{response.body}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

  # Sync transactions for all active Teller bank connections
  def sync_all_transactions
    banks.each do |bank|
      sync_transactions_for_bank(bank)
    end
  end

  # Sync transactions for a specific bank connection
  def sync_transactions_for_bank(bank)
    Rails.logger.info "[Teller] Syncing transactions for #{bank.name}"

    begin
      raw_transactions = fetch_transactions(bank)

      filtered_transactions = raw_transactions.filter do |trx|
        allowed_types = %w[card_payment refund fee transaction]
        is_transaction = allowed_types.include?(trx['type'])
        is_complete = trx['status'] == 'posted'
        trx_date = Date.parse(trx['date'])

        # Use bank's sync_from_date if set, otherwise sync all
        date_ok = bank.sync_from_date.nil? || trx_date > bank.sync_from_date

        date_ok && is_complete && is_transaction
      end

      Rails.logger.info "[Teller] Found #{filtered_transactions.count} transactions for #{bank.name}"

      filtered_transactions.each do |trx|
        f = FinancialTransaction.find_or_initialize_by(plaid_id: trx['id'])

        next if f.reviewed?

        f.transacted_at = trx['date']
        f.plaid_name = trx.dig('description') || trx.dig('details', 'counterparty', 'name')
        f.amount = trx['amount'].to_f
        f.source = bank.name
        f.raw_data = trx

        f.save!
      end

      Rails.logger.info "[Teller] Finished syncing #{bank.name}"
    rescue TellerError => e
      Rails.logger.error "[Teller] Error syncing #{bank.name}: #{e.message}"
      # Continue with other banks even if one fails
    end
  end

  private

  # Get all active Teller bank connections
  def banks
    BankConnection.active.teller
  end

  # Fetch transactions from Teller API for a specific bank
  def fetch_transactions(bank)
    url = "https://api.teller.io/accounts/#{bank.account_id}/transactions"
    uri = URI(url)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_PEER
    http.cert = @cert
    http.key = @key

    request = Net::HTTP::Get.new(uri.request_uri)
    request['Authorization'] = "Basic #{Base64.strict_encode64(bank.token + ':')}"

    response = http.request(request)

    raise TellerError, "Error: #{response.body}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

end
