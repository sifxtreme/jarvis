require 'mail'

DEFAULT_EMAIL = 'asifahmed2011@gmail.com'

options = {
  :address              => "smtp.gmail.com",
  :port                 => 587,
  :user_name            => 'asif.h.ahmed@gmail.com',
  :password             => ENV['GMAIL_TOKEN'],
  :authentication       => 'plain',
  :enable_starttls_auto => true
}

Mail.defaults do
  delivery_method :smtp, options
end

def email(options = {})
  subject = options[:subject] || 'Mailer'
  body = options[:body] || 'Empty Body'
  to_mail = options[:to_email] || DEFAULT_EMAIL
  from_mail = options[:user_name] || DEFAULT_EMAIL
  reply_to = options[:reply_to] || DEFAULT_EMAIL

  Mail.deliver do
    to to_mail
    from from_mail
    reply_to reply_to
    subject subject
    body body
  end
end

email(options)
