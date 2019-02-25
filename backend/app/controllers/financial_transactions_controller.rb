class FinancialTransactionsController < ApplicationController

  def index
    db_query = FinancialTransaction.all

    year = params[:year]
    month = params[:month]
    query = params[:query]
    db_query = db_query.where('YEAR(transacted_at) = ?', year) if year
    db_query = db_query.where('MONTH(transacted_at) = ?', month) if month
    db_query = db_query.where('category like ? or merchant_name like ? or plaid_name like ?', "%#{query}%", "%#{query}%", "%#{query}%") if query
    # db_query = db_query.limit(10)
    results = db_query.order('transacted_at DESC')

    render json: { results: results.map }
  end

  def create
    data = JSON.parse(request.body.read)
    
    f = FinancialTransaction.new
    f.plaid_id = data['plaid_id']
    f.plaid_name = data['merchant_name']
    f.merchant_name = data['merchant_name']
    f.category = data['category']
    f.amount = data['amount']
    date = begin
             Date.parse(data['transacted_at'])
           rescue StandardError
             Date.today
           end
    f.transacted_at = date
    f.source = data['source']
    f.hidden = data['hidden'] || false
    f.reviewed = true
    f.save!

    render json: f
  end

  def update
    data = JSON.parse(request.body.read)

    f = FinancialTransaction.find(params[:id])
    f.merchant_name = data['merchant_name']
    f.category = data['category']
    f.amount = data['amount']
    date = begin
             Date.parse(data['transacted_at'])
           rescue StandardError
             Date.today
           end
    f.transacted_at = date
    f.source = data['source']
    f.hidden = data['hidden'] || false
    f.reviewed = true
    f.save!

    render json: f
  end

end
