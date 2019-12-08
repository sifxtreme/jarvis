class Finances::Balances

  def total_current_balance
    PlaidBank.all.inject(0) do |sum, x|
      sum + x.latest_balance.round(2)
    end
  end

  def latest_balances
    PlaidBank.all.map do |x|
      {
        name: x.name,
        balance: x.latest_balance.round(2)
      }
    end
  end

end
