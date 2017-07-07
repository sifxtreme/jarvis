class SouthwestRunner

  @queue = :high

  def self.perform
    Southwest::Search.new.runner
  end

end