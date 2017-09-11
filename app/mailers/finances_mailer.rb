class FinancesMailer < ApplicationMailer
  helper MailerHelper

  def daily_report(total, all_categories, uncategorized_records)
    @total = total
    @all_categories = all_categories
    @uncategorized_records = uncategorized_records
    @balance = Plaid::Api.new.all_balances[:total]
    mail(to: 'asif.h.ahmed@gmail.com',
      cc: 'hsayyeda@gmail.com',
      subject: "Finances - #{DateTime.now.strftime('%m/%d/%Y')}")
  end

end
