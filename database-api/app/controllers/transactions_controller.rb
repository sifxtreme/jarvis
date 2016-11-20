class TransactionsController < ApplicationController

  def index
    if params[:sync_to_drive]
      render json: FinancialTransaction.
        select(:id, :plaid_id, :plaid_name, :amount, :transacted_at).
        where(uploaded: false).
        order(:transacted_at)
    elsif params[:sync_from_drive]
      render json: FinancialTransaction.
        select(:id, :plaid_id, :plaid_name, :amount, :transacted_at).
        where('transacted_at >= ?', '2016-11-01 00:00:00').
        where('spreadsheet_name IS NULL').
        where(uploaded: true).
        where(hidden: [false, nil]).
        order(:transacted_at)
    else
      render json: FinancialTransaction.all
    end
  end

  def update
    data = params.permit(:plaid_id, :spreadsheet_name, :uploaded, :category, :hidden).to_h

    f = FinancialTransaction.where(plaid_id: data['plaid_id']).first
    f.uploaded = data['uploaded']
    f.spreadsheet_name = data['spreadsheet_name']
    f.category = data['category']
    f.hidden = data['hidden']
    f.save!

    head :no_content
  end

  def batch_upload
    ActionController::Parameters.permit_all_parameters = true

    params.to_h['transactions'].each do |data|
      next if FinancialTransaction.where(plaid_id: data['id']).any?
      
      f = FinancialTransaction.find_or_initialize_by(plaid_id: data['id'])
      f.transacted_at = data['date']
      f.plaid_name = data['name']
      f.amount = data['amount']
      f.source = data['type']
      f.save!
    end
  end
  
end
