class FinancesController < ApplicationController

  def rolling_budget
    render json: Finances::Budget.new.current_budget_for_rolling_categories
  end

  def transactions
    db_query = FinancialTransaction.all
    
    year = params[:year]
    month = params[:month]
    query = params[:query]
    db_query = db_query.where("YEAR(transacted_at) = ?", year) if year
    db_query = db_query.where("MONTH(transacted_at) = ?", month) if month
    db_query = db_query.where("category like ? or spreadsheet_name like ? or plaid_name like ?", "%#{query}%", "%#{query}%", "%#{query}%") if query
    
    results = db_query.order('transacted_at DESC')
    total = results.inject(0){|sum,x| sum + x.amount }
    
    render json: {total: total, results: results.map }
  end
  
end