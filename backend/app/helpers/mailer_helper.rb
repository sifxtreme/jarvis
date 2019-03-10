module MailerHelper
  def format_number(num)
    format('%.2f', num).rjust(7, ' ')
  end
end
