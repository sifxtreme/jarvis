class SyncBalancesForBank < ApplicationJob

  @queue = :low

  def self.perform(bank_id)
    bank = ::PlaidBank.find(bank_id)
    PlaidService::API.new.sync_balances_for_bank(bank)
  end

end
