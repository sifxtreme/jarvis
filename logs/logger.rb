require 'logger'

class JarvisLogger

  attr_accessor :logger

  def initialize
    @logger = Logger.new('logs/jarvis.log')
    @logger.level = Logger::INFO
  end

end