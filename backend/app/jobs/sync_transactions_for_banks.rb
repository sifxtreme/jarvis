class SyncTransactionsForBanks

  @queue = :orchestrator

  def self.perform
    Teller::API.new.sync_all_transactions
    Finances::Predictions.new.predict_new_transactions
  end

end
