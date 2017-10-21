class PlaidController < ApplicationController

  def balances
    x = plaid_api_service.all_balances

    render :json => x
  end

  def balance
    x = plaid_api_service.balance_for_account(params[:id])
    x = plaid_api_service.raw_balance_for_account(params[:id]) if params[:type] == "raw"
    render :json => {balance: x}.to_json
  end

  def transactions
    x = plaid_api_service.transactions_for_account(params[:id])
    x = plaid_api_service.raw_transactions_for_account(params[:id]) if params[:type] == "raw"
    render :json => x.to_json
  end

  private

  def plaid_api_service
    Plaid::Api.new
  end
  
end