class Finances::Balances

  def total_current_balance
    PlaidBank.all.inject(0) do |sum, x|
      sum + x.latest_balance.round(2)
    end
  end

end
