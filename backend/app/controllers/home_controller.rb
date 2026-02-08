class HomeController < ApplicationController
  skip_before_action :validate_header, only: [:index]

  BOOT_TIME = Time.now.utc.iso8601
  GIT_SHA = File.read(Rails.root.join('REVISION')).strip rescue 'unknown'

  def index
    render json: {
      app_name: 'jarvis',
      environment: Rails.env,
      sha: GIT_SHA,
      boot_time: BOOT_TIME
    }
  end
end
