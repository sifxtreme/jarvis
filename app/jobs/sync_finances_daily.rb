class SyncFinancesDaily

  @queue = :high

  def self.perform
    Plaid::Api.new.sync_all
    Analysis::Finances.new.analyze_new_transactions
    GoogleDrive::FinancesSpreadsheet.new.sync_to_drive
  end

end