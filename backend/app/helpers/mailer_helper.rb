module MailerHelper
  def format_number(n)
    ('%.2f' % n).rjust(7, ' ')
  end
end