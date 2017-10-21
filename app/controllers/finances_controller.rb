class FinancesController < ApplicationController

  def this_month
    f = Notifications::Finances.new

    render json: f.month_snapshot
  end

  def last_month
    f = Notifications::Finances.new

    previous_month = Time.now.beginning_of_month - 1.day
    
    render json: f.month_snapshot(previous_month.strftime('%m'), previous_month.strftime('%Y'))
  end

  def rolling_budget
    render json: Analysis::Finances.new.current_budget_for_rolling_categories
  end

  def transactions
    results = FinancialTransaction.where('transacted_at > ?', 3.months.ago).order('transacted_at')
    render json: results
  end

  def search
    db_query = FinancialTransaction.where("transacted_at >= '2016-11-01'")
    query = params[:query]
    results = db_query.where("category like ? or spreadsheet_name like ? or plaid_name like ?", "%#{query}%", "%#{query}%", "%#{query}%").order('transacted_at DESC')
    total = results.inject(0){|sum,x| sum + x.amount }
    render json: {total: total, results: results.map }
  end
  
end