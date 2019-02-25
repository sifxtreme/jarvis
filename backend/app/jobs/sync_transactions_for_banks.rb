class SyncTransactionsForBanks < ApplicationJob

  @queue = :high

  def self.perform
    PlaidService::API.new.sync_all_transactions(true)
  end

end
