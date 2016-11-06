class TransactionsController < ApplicationController

  def index
    render json: FinancialTransaction.
      select(:id, :plaid_id, :plaid_name, :amount, :transacted_at).
      where(uploaded: false).
      order(:transacted_at)
  end

  def update
    data = params.permit(:id, :spreadsheet_name, :uploaded, :category).to_h

    f = FinancialTransaction.find(data['id'])
    f.uploaded = data['uploaded']
    f.spreadsheet_name = data['spreadsheet_name']
    f.category = data['category']
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
