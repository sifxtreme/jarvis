class ApplicationController < ActionController::API
  include ActionController::Cookies
  include GoogleAuth
  include JwtAuth
  include PaperTrail::Rails::Controller

  before_action :validate_header
  before_action :set_paper_trail_whodunnit

  def validate_header
    return if Rails.env.development?

    Rails.logger.tagged("AUTH") { Rails.logger.warn "Validating authorization header: #{request.headers['Authorization']}" }

    token = bearer_token
    if token.present?
      payload = decode_jwt(token)
      if payload
        @current_user_email = payload['sub']
        return
      end

      authenticate_google!
      return
    end

    render json: { msg: 'Unauthorized' }, status: 401 unless request.headers['Authorization'] == ENV['JARVIS_RAILS_PASSWORD']
  end

  def user_for_paper_trail
    current_user&.id&.to_s || current_user&.email
  end
end
