class FinancesDailyReport

  @queue = :high

  def self.perform
    finances_email = FinancesMailer.daily_report
    finances_email.deliver_now
  end

end