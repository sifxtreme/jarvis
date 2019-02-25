class SyncTransactionsForBank < ApplicationJob

  @queue = :high

  def self.perform(bank_id)
    bank = ::PlaidBank.find(bank_id)
    PlaidService::API.new.sync_transactions_for_bank(bank)
  end

end
