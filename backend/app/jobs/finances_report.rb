class FinancesReport < ApplicationJob

  @queue = :high

  def self.perform
    finances_email = FinancesMailer.daily_summary
    finances_email.deliver_now
  end

end
