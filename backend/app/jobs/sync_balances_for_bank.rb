class SyncBalancesForBank < ApplicationJob

  @queue = :high

  def self.perform(bank_id)
    Rails.logger.info('Resque Starting SyncBalancesForBank')
    bank = ::PlaidBank.find(bank_id)
    PlaidService::API.new.sync_balances_for_bank(bank)
  end

end
