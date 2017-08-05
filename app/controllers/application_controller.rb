class ApplicationController < ActionController::API
  include ActionController::HttpAuthentication::Basic::ControllerMethods
  http_basic_authenticate_with name: ENV['JARVIS_USER'], password: ENV['JARVIS_PASS']
end
