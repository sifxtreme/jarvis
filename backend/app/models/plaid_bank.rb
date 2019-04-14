class PlaidBank < ApplicationRecord

  has_many :balances, class_name: 'PlaidBalance', foreign_key: 'bank_name', primary_key: 'name'

  def latest_balance
    card_balances = {}

    balances.each do |balance|
      total_balance = balance.current_balance + balance.pending_balance
      begin
        card_balances[balance.card_name] << total_balance
      rescue StandardError => _
        card_balances[balance.card_name] = [total_balance]
      end
    end

    card_balances.values.inject(0) { |sum, x| sum + x.last }
  end

end
