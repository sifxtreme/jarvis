class HomeController < ApplicationController

  def index
headers['Access-Control-Allow-Origin'] = '*'
headers['Access-Control-Allow-Methods'] = 'POST, PUT, DELETE, GET, OPTIONS'
headers['Access-Control-Request-Method'] = '*'
headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    render json: {app_name: 'jarvis', environment: Rails.env}
  end
  
end