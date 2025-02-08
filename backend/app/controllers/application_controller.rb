class ApplicationController < ActionController::API

  before_action :validate_header

  def validate_header
    return if Rails.env.development?

    Rails.logger.tagged("AUTH") { Rails.logger.warn "Validating authorization header: #{request.headers['Authorization']}" }

    render json: { msg: 'Unauthorized' }, status: 401 unless request.headers['Authorization'] == ENV['JARVIS_RAILS_PASSWORD']
  end

end
