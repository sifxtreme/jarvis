class FinancesMailer < ApplicationMailer
  helper MailerHelper

  def daily_report
    
    month_snapshot = Finances::MonthAnalysis.new.month_snapshot
    @total = month_snapshot[:total]
    @all_categories = month_snapshot[:all_categories]
    @uncategorized_records = month_snapshot[:uncategorized_records]
    
    @balance = Plaid::Api.new.all_balances[:total]
    
    mail(to: 'asif.h.ahmed@gmail.com',
      cc: 'hsayyeda@gmail.com',
      subject: "Finances - #{DateTime.now.strftime('%m/%d/%Y')}")

  end

end
