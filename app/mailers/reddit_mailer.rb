class RedditMailer < ApplicationMailer

  def newsletter(information)
    @subreddits = information
    mail(to: 'asif.h.ahmed@gmail.com',
      subject: "Reddit - #{DateTime.now.strftime('%m/%d/%Y')}")
  end
  
end