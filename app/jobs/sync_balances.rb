class SyncBalances

  @queue = :high

  def self.perform
    Plaid::Api.new.sync_all_balances
  end

end