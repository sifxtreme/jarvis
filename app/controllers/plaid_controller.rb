class PlaidController < ApplicationController

  def balances
    render json: pa.balances
  end

  def transactions
    render json: pa.transactions_for_account(bank)
  end

  private

  def bank
    PlaidBank.find_by_name(params[:bank_id])
  end

  def pa
    Plaid::Api.new
  end
  
end