class TellerController < ApplicationController
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
end
