class FinancesReport

  @queue = :emailer

  def self.perform
    finances_email = FinancesMailer.daily_summary
    finances_email.deliver_now
  end

end
