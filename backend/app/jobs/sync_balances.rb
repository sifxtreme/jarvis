class SyncBalances

  @queue = :high

  def self.perform
    PlaidService::Api.new.sync_all_balances
  end

end