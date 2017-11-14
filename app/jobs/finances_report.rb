class FinancesReport

  @queue = :high

  def self.perform
    finances_email = FinancesMailer.report
    finances_email.deliver_now
  end

end