class SyncBalance

  @queue = :low

  def self.perform(bank_id)
    bank = ::PlaidBank.find(bank_id)
    PlaidService::Api.new.sync_balance_for_bank(bank)
  end

end