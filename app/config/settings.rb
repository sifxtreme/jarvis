require 'yaml'

class Settings
  class << self

    def config
      @@config ||= YAML.load_file(File.join(__dir__, 'config.yml'))
    end

    def google_access_token
      config['google_drive']['google_access_token']
    end

    def plaid_api
      config['plaid']['api']
    end

    def plaid_access_tokens
      config['plaid']['access_tokens']
    end

    def gmail_token
      config['gmail']
    end

  end
end