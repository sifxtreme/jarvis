module Reddit
  class Newsletter

    SUBREDDITS = %w[rails ruby programming commandline mealtimevideos webdev losangeles].freeze

    def email_newsletter
      info = SUBREDDITS.map { |s| [s, get_subreddit_info(s)] }.to_h
      reddit_email = RedditMailer.newsletter(info)
      reddit_email.deliver_now
    end

    private

    def get_subreddit_info(subreddit)
      response = RestClient.get("https://www.reddit.com/r/#{subreddit}/top/.json?sort=top&t=week")
      info = JSON.parse(response.body)
      info['data']['children'].first(10).map do |x|
        {
          title: x['data']['title'],
          url: x['data']['url'],
          comments: x['data']['permalink']
        }
      end
    end

  end
end
