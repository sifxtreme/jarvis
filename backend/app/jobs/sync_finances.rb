class SyncFinances

  @queue = :high

  def self.perform
    Plaid::Api.new.sync_all_transactions
    Finances::Predictions.new.predict_new_transactions
  end

end