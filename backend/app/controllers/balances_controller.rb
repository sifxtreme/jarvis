class BalancesController < ApplicationController

  def index
    render json: Finances::Balances.new.latest_balances
  end

end
