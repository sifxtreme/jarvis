module GoogleDrive
  class GoogleSessionConfig

    FIELDS = %w(client_id client_secret scope refresh_token).freeze
    attr_accessor(*FIELDS)

    def initialize(token = nil)
      @refresh_token = token || ENV['JARVIS_GOOGLE_DRIVE_ACCESS_TOKEN']

      @config_path = './config.json'

      if @refresh_token.nil?
        if ::File.exist?(@config_path)
          JSON.parse(::File.read(@config_path)).each do |key, value|
            instance_variable_set("@#{key}", value) if FIELDS.include?(key)
          end
        end
      end

    end

    def save
      # puts to_json
      # ::File.open(@config_path, 'w', 0600) { |f| f.write(to_json) }
    end

    private

    def to_json
      hash = {}
      FIELDS.each do |field|
        value = __send__(field)
        hash[field] = value if value
      end
      JSON.pretty_generate(hash)
    end

  end
end