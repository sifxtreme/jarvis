class ApplicationController < ActionController::API

  before_action :validate_header

  def validate_header
    return if Rails.env.development?

    render json: { msg: 'Unauthorized' }, status: 401 unless request.headers['Authorization'] == ENV['JARVIS_RAILS_PASSWORD']
  end

end
