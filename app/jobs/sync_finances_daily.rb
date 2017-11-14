class SyncFinancesDaily

  @queue = :high

  def self.perform
    Plaid::Api.new.sync_all_transaction
    Finances::Predictions.new.predict_new_transactions
  end

end