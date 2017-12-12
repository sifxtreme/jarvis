require 'rest-client'

module Notifications
  class Android

    API_KEY = 'uqw54g'
    API_URL = 'https://api.simplepush.io/send'

    def send_data(title = 'Default Title', body = 'Default Body')
      data = {
        key: API_KEY,
        title: title,
        msg: body
      }
      RestClient.post API_URL, data
    end
  end
end
