class FinancialTransactionsController < ApplicationController

  def index
    year = params[:year]
    month = params[:month]
    query = params[:query]
    show_hidden = params[:show_hidden]
    show_needs_review = params[:show_needs_review]
    db_query = FinancialTransaction.select(:id, :plaid_id, :plaid_name, :merchant_name, :category, :source, :amount, :transacted_at, :created_at,
                                           :updated_at, :hidden, :reviewed).all
    db_query = db_query.where('extract(year from transacted_at) = ?', year) if year && year != 'null'
    db_query = db_query.where('extract(month from transacted_at) = ?', month) if month && month != 'null'
    db_query = db_query.where('category like ? or merchant_name like ? or plaid_name like ?', "%#{query}%", "%#{query}%", "%#{query}%") if query
    db_query = db_query.where('hidden is true') if show_hidden == 'true'
    db_query = db_query.where('hidden is false') if show_hidden == 'false'
    db_query = db_query.where('reviewed is false') if show_needs_review == 'true'
    db_query = db_query.order('transacted_at DESC, id DESC')

    render json: { results: db_query.map }
  end

  def create
    data = JSON.parse(request.body.read)

    f = FinancialTransaction.new
    f.plaid_id = data['plaid_id']
    f.plaid_name = data['merchant_name']
    f.merchant_name = data['merchant_name']
    f.category = data['category']
    f.amount = data['amount']
    f.transacted_at = get_date(data['transacted_at'])
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
    f.transacted_at = get_date(data['transacted_at'])
    f.source = data['source']
    f.hidden = data['hidden'] || false
    f.reviewed = true
    f.save!

    render json: f
  end

  private

  def get_date(date_param)
    Date.parse(date_param)
  rescue StandardError
    Date.today
  end

end
