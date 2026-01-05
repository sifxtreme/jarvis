class ApplicationController < ActionController::API
  include ActionController::Cookies
  include GoogleAuth
  include PaperTrail::Rails::Controller

  before_action :validate_header
  before_action :set_paper_trail_whodunnit

  def validate_header
    return if Rails.env.development?

    Rails.logger.tagged("AUTH") { Rails.logger.warn "Validating authorization header: #{request.headers['Authorization']}" }

    if session[:user_email].present?
      @current_user_email = session[:user_email]
      return
    end

    if allow_google_auth?
      authenticate_google!
      return
    end

    render json: { msg: 'Unauthorized' }, status: 401 unless request.headers['Authorization'] == ENV['JARVIS_RAILS_PASSWORD']
  end

  def user_for_paper_trail
    current_user&.id&.to_s || current_user&.email
  end
end
