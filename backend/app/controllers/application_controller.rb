class ApplicationController < ActionController::API
  include GoogleAuth

  before_action :validate_header

  def validate_header
    return if Rails.env.development?

    Rails.logger.tagged("AUTH") { Rails.logger.warn "Validating authorization header: #{request.headers['Authorization']}" }

    if allow_google_auth?
      authenticate_google!
      return
    end

    render json: { msg: 'Unauthorized' }, status: 401 unless request.headers['Authorization'] == ENV['JARVIS_RAILS_PASSWORD']
  end

end
