class RedditNewsletter

  @queue = :emailer

  def self.perform
    Reddit::Newsletter.new.email_newsletter
  end

end
