class SyncBalancesForBanks

  @queue = :orchestrator

  def self.perform
    PlaidService::API.new.sync_all_balances(true)
  end

end
