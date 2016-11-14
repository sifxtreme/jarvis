require 'yaml'

class GoogleDriveSettings
  class << self

    def google_access_token
      config['google_access_token']
    end

    def config
      @@config ||= YAML.load_file(File.join(__dir__, 'config.yml'))
    end

  end
end