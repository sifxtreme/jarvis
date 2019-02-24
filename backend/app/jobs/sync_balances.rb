class SyncBalances

  @queue = :high

  def self.perform
    PlaidService::API.new.sync_all_balances(true)
  end

end
