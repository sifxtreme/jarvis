require 'logger'

class JLogger

  def self.logger
    @@logger_ ||= begin
      logger = Logger.new(STDOUT)
      logger.level = Logger::INFO
      logger
    end
  end
end