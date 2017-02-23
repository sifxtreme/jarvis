require 'rest-client'
require 'mail'

require_relative '../../config/settings'

module Notifications
  class Email

    DEFAULT_EMAIL = 'asifahmed2011@gmail.com'

    MAIL_OPTIONS = {
      :address              => "smtp.gmail.com",
      :port                 => 587,
      :user_name            => 'asif.h.ahmed@gmail.com',
      :password             => Settings.gmail_token,
      :authentication       => 'plain',
      :enable_starttls_auto => true
    }

    Mail.defaults do
      delivery_method :smtp, MAIL_OPTIONS
    end

    def email(options = {})
      options.merge!(MAIL_OPTIONS)

      subject = options[:subject] || 'Mailer'
      body = options[:body] || 'Empty Body'
      to_mail = options[:to_email] || DEFAULT_EMAIL
      from_mail = options[:user_name] || DEFAULT_EMAIL
      reply_to = options[:reply_to] || DEFAULT_EMAIL
      cc = options[:cc] || DEFAULT_EMAIL

      Mail.deliver do
        to to_mail
        cc cc
        from from_mail
        reply_to reply_to
        subject subject
        html_part do
          content_type 'text/html; charset=UTF-8'
          body body
        end
      end

    end

  end
end
