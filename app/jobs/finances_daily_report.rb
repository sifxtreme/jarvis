class FinancesDailyReport

  @queue = :high

  def self.perform
    Notifications::Finances.new.daily_report
  end

end