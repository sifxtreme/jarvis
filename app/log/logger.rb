require 'logger'

class JarvisLogger

  def self.logger
    logger = Logger.new("#{File.dirname(__FILE__)}/jarvis.log")
    logger.level = Logger::INFO

    logger
  end

end