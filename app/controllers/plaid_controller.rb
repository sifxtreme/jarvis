class PlaidController < ApplicationController

  def raw_balance
    x = plaid_api_service.raw_balance_for_account(params[:id])
    render :json => x.to_json
  end

  def raw_transactions
    x = plaid_api_service.raw_transactions_for_account(params[:id])
    render :json => x.to_json
  end

  def balance
    x = plaid_api_service.balance_for_account(params[:id])
    render :json => {balance: x}.to_json
  end

  def transactions
    x = plaid_api_service.transactions_for_account(params[:id])
    render :json => x.to_json
  end

  def balances
    x = plaid_api_service.all_balances
    render :json => x
  end

  private

  def plaid_api_service
    Plaid::Api.new
  end
  
end