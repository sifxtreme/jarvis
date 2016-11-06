require 'yaml'

class Settings
  class << self

    def access_tokens
      config['access_tokens']
    end

    def config
      @@config ||= YAML.load_file(File.join(__dir__, 'config.yml'))
    end

  end
end