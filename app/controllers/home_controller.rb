class HomeController < ApplicationController

  def index
    render :json => {app_name: 'jarvis', environment: Rails.env}
  end

  def job
    response = Resque.enqueue(TestJobX)
    render :json => response.to_json
  end
  
end