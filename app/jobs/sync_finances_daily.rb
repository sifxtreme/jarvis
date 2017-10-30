class SyncFinancesDaily

  @queue = :high

  def self.perform
    Plaid::Api.new.sync_all
    Finances::Predictions.new.predict_new_transactions
  end

end