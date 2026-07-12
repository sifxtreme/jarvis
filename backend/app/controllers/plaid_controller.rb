class PlaidController < ApplicationController
  # POST /plaid/link_token
  # Returns a short-lived link_token used to initialize Plaid Link in the browser.
  def link_token
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    begin
      api = Plaid::API.new
      result = api.create_link_token(user.id)
      render json: { link_token: result['link_token'] }
    rescue Plaid::API::PlaidError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # Which bank_connection a Plaid link may create/update. An allowlist, not a free
  # string: a typo must never silently mint a junk connection that then syncs into
  # a `source` nothing else recognises.
  LINKABLE_NAMES = %w[amex hafsa_chase].freeze

  # POST /plaid/exchange
  # Body: { public_token: 'public-...', name: 'amex' | 'hafsa_chase' }
  # Exchanges the public_token for a permanent access_token, discovers the account,
  # and upserts the provider='plaid' bank_connection row for that bank.
  #
  # `name` used to be hardcoded to 'amex' — which meant linking a SECOND bank would
  # silently clobber the working Amex connection. It must be explicit.
  def exchange
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    public_token = params[:public_token].to_s.strip
    if public_token.blank?
      render json: { error: 'public_token is required' }, status: :bad_request
      return
    end

    name = params[:name].to_s.strip.presence || 'amex'
    unless LINKABLE_NAMES.include?(name)
      render json: { error: "name must be one of: #{LINKABLE_NAMES.join(', ')}" }, status: :bad_request
      return
    end

    begin
      api = Plaid::API.new
      exchanged = api.exchange_public_token(public_token)
      access_token = exchanged['access_token']

      accounts = api.list_accounts(access_token)['accounts'] || []
      account = pick_account(accounts)
      account_id = account && account['account_id']

      connection = BankConnection.find_or_initialize_by(
        provider: BankConnection::PROVIDER_PLAID,
        name: name
      )
      connection.token = access_token
      connection.account_id = account_id if account_id.present?
      connection.is_active = true
      # On first connect, start Plaid where the previous provider left off. Plaid's
      # backfill reaches ~24 months, and Plaid txn ids DIFFER from Teller's, so
      # find_or_initialize_by(plaid_id) cannot dedupe across them — without a cutoff
      # we'd re-insert the entire history as duplicates. Cut over at the last txn
      # already recorded for this source. Only set on create; never override an
      # existing cutoff on re-connect.
      if connection.sync_from_date.nil?
        connection.sync_from_date = FinancialTransaction.where(source: name).maximum(:transacted_at)&.to_date
      end
      connection.save!

      render json: {
        bank_connection_id: connection.id,
        name: connection.name,
        provider: connection.provider,
        account_id: connection.account_id,
        is_active: connection.is_active
      }
    rescue Plaid::API::PlaidError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  private

  # Prefer a credit account (the Amex card), then a depository account, then the
  # first account returned. Amex OAuth typically returns a single credit account.
  def pick_account(accounts)
    accounts.find { |a| a['type'] == 'credit' } ||
      accounts.find { |a| a['type'] == 'depository' } ||
      accounts.first
  end
end
