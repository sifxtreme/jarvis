require 'logger'

class JarvisLogger

  attr_accessor :logger

  def initialize
    @logger = Logger.new("#{File.dirname(__FILE__)}/jarvis.log")
    @logger.level = Logger::INFO
  end

end