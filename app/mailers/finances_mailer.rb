class FinancesMailer < ApplicationMailer
  helper MailerHelper

  def daily_report(all_categories, uncategorized_records)
    @all_categories = all_categories
    @uncategorized_records = uncategorized_records
    mail(to: 'asif.h.ahmed@gmail.com',
      # cc: 'hsayyeda@gmail.com',
      subject: "Finances - #{DateTime.now.strftime('%m/%d/%Y')}")
  end

end