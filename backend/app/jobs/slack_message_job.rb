class SlackMessageJob
  @queue = :slack

  def self.perform(payload)
    SlackMessageHandler.new(payload).process!
  end
end
