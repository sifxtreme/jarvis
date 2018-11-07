class ApplicationController < ActionController::API

  # before_action :validate_header

  def validate_header
    render json: {}, status: 401 unless request.headers["Authorization"] == ENV["JARVIS_RAILS_PASSWORD"]
  end
  
end
