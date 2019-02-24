class SyncFinances

  @queue = :high

  def self.perform
    Plaid::API.new.sync_all_transactions
    Finances::Predictions.new.predict_new_transactions
  end

end