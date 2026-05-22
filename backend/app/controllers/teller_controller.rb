class TellerController < ApplicationController
  # GET /teller/health
  # Returns latest sync status for active Teller connections
  def health
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    connections = BankConnection.active.teller
    logs = latest_sync_logs_for(connections)
    application_id = TellerEnrollment.where(user: user).order(updated_at: :desc).first&.application_id
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
        enrollment_id: connection.enrollment_id,
        application_id: application_id,
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

  # POST /teller/connections/:id/repair
  # Body: { access_token: 'token_...', enrollment_id?: 'enr_...', application_id?: 'app_...' }
  # Verifies the token, then writes the new token (and enrollment_id) to the bank_connection.
  # Also upserts teller_enrollments so the application_id stays known.
  def repair
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    connection = BankConnection.active.teller.find_by(id: params[:id])
    return render json: { error: 'Connection not found' }, status: :not_found unless connection

    access_token = params[:access_token].to_s.strip
    enrollment_id = params[:enrollment_id].to_s.strip.presence || connection.enrollment_id
    application_id = params[:application_id].to_s.strip.presence

    if access_token.blank?
      render json: { error: 'access_token is required' }, status: :bad_request
      return
    end

    begin
      api = Teller::API.new
      accounts = api.list_accounts(access_token)
      account_ids = accounts.map { |a| a['id'] }
      unless account_ids.include?(connection.account_id)
        render json: {
          error: "Token does not include account #{connection.account_id} (got: #{account_ids.join(', ')})"
        }, status: :unprocessable_entity
        return
      end
    rescue Teller::API::TellerError => e
      render json: { error: "Token verification failed: #{e.message}" }, status: :unprocessable_entity
      return
    end

    connection.update!(token: access_token, enrollment_id: enrollment_id.presence)

    if enrollment_id.present? && application_id.present?
      enrollment = TellerEnrollment.find_or_initialize_by(user: user, enrollment_id: enrollment_id)
      enrollment.application_id = application_id
      enrollment.save!
    end

    render json: {
      bank_connection_id: connection.id,
      name: connection.name,
      enrollment_id: connection.enrollment_id,
      account_id: connection.account_id
    }
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
