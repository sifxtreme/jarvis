class HomeController < ApplicationController

  def index
    render json: {app_name: 'jarvis', environment: Rails.env}
  end
  
end