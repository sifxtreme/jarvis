class GoogleAuthController < ActionController::API
  include GoogleAuth

  before_action :authenticate_google!
end
