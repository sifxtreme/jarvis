require 'rest-client'
require 'pry'
require 'json'

require_relative '../notifications/email'

module Reddit

  class Newsletter

    SUBREDDITS = %w(rails ruby javascript programming commandline elixir mealtimevideos losangeles)
  
    def email_report
      message = ""

      SUBREDDITS.each do |s|
        info = get_subreddit_info(s)
        message << email_message(s, info)
      end

      emailer.email({
        subject: "Reddit - #{DateTime.now.strftime('%m/%d/%Y')}",
        body: message,
        to_email: 'asifahmed2011@gmail.com'
      })
    end

    def emailer
      ::Notifications::Email.new
    end

    def email_message(subreddit, data)
      message = "<div>"

      message << "<h2>#{subreddit}</h2>"

      data.each do |d|
        message << "<p><a href='#{d[:url]}'>#{d[:title]}</a></p>"
      end

      message
    end

    private

    def get_subreddit_info(subreddit)
      response = RestClient.get("https://www.reddit.com/r/#{subreddit}/top/.json?sort=top&t=week")
      info = JSON.parse(response.body)
      info["data"]["children"].first(10).map {|x| {title: x["data"]["title"], url: x["data"]["url"]} }
    end
    
  end

end
