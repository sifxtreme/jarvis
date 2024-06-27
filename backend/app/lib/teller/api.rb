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

    @auth_token = 'token_rcfttbdxrcnqpyd3vx6a57mutm'
  end

  def sync_all_transactions
    hardcoded_date_limit = Date.parse('2024-06-15')

    filtered_transactions = transactions.filter do |trx|
      is_transaction = trx['type'] == 'card_payment' || trx['type'] == 'refund'
      is_complete = trx['status'] == 'posted'
      trx_date = Date.parse(trx['date'])

      trx_date > hardcoded_date_limit && is_complete && is_transaction
    end

    filtered_transactions.each do |trx|
      f = FinancialTransaction.find_or_initialize_by(plaid_id: trx['id'])

      f.transacted_at = trx['date']
      f.plaid_name = trx.try(:[], 'details').try(:[], 'counterparty').try(:[], 'name') || trx.try(:[], 'description')
      f.amount = trx['amount'].to_f
      f.source = 'amex' # only amex transactions are synced for now
      f.raw_data = trx

      f.save!
    end
  end

  private

  def transactions
    url = 'https://api.teller.io/accounts/acc_p0lv582dt0rb4t46fi000/transactions'
    uri = URI(url)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_PEER
    http.cert = @cert
    http.key = @key

    request = Net::HTTP::Get.new(uri.request_uri)
    request['Authorization'] = "Basic #{Base64.strict_encode64(@auth_token + ':')}"

    response = http.request(request)

    raise TellerError, "Error: #{response.body}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

end
