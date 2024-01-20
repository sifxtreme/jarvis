class SyncTransactionsForBanks

  @queue = :orchestrator

  def self.perform
    PlaidService::API.new.sync_all_transactions
    Finances::Predictions.new.predict_new_transactions
  end

end
