class RedditNewsletter

  @queue = :high

  def self.perform
    Reddit::Newsletter.new.email_newsletter
  end

end