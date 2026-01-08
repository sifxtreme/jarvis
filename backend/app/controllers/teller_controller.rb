class TellerController < ApplicationController
  # GET /teller/health
  # Returns latest sync status for active Teller connections
  def health
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    connections = BankConnection.active.teller
    logs = latest_sync_logs_for(connections)
    cutoff = 30.days.ago.to_date

    unhealthy = connections.map do |connection|
      log = logs[connection.id]
      latest_date = log&.latest_transaction_date
      stale = latest_date.nil? || latest_date < cutoff
      error = log&.status == 'error'
      next unless error || stale

      {
        bank_connection_id: connection.id,
        name: connection.name,
        status: log&.status || 'missing',
        latest_transaction_date: latest_date,
        fetched_count: log&.fetched_count || 0,
        filtered_count: log&.filtered_count || 0,
        inserted_count: log&.inserted_count || 0,
        updated_count: log&.updated_count || 0,
        last_synced_at: log&.finished_at,
        error: log&.error,
        reason: error ? 'error' : 'stale'
      }
    end.compact

    render json: { unhealthy: unhealthy }
  end

  # GET /teller/accounts?token=xxx
  # Lists all accounts for a given Teller access token
  def accounts
    token = params[:token]

    if token.blank?
      render json: { error: 'Token is required' }, status: :bad_request
      return
    end

    begin
      api = Teller::API.new
      accounts = api.list_accounts(token)
      render json: accounts
    rescue Teller::API::TellerError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  private

  def latest_sync_logs_for(connections)
    ids = connections.pluck(:id)
    return {} if ids.empty?

    logs = BankSyncLog
           .select('DISTINCT ON (bank_connection_id) bank_sync_logs.*')
           .where(bank_connection_id: ids, provider: 'teller')
           .order('bank_connection_id, started_at DESC NULLS LAST, created_at DESC')
    logs.index_by(&:bank_connection_id)
  end
end
