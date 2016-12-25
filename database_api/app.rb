require 'sinatra'
require 'sinatra/activerecord'
require 'pry'

require_relative './models/financial_transaction.rb'

set :bind, '0.0.0.0'

set :database_file, "./database.yml"

set :logging, true

get '/transactions/' do
  content_type :json

  if params[:sync_to_drive]
    FinancialTransaction.
      select(:id, :plaid_id, :plaid_name, :amount, :transacted_at).
      where(uploaded: false).
      order(:transacted_at).to_json
  elsif params[:sync_from_drive]
    FinancialTransaction.
      select(:id, :plaid_id, :plaid_name, :amount, :transacted_at).
      where('transacted_at >= ?', '2016-11-01 00:00:00').
      where('spreadsheet_name IS NULL').
      where(uploaded: true).
      where(hidden: [false, nil]).
      order(:transacted_at).to_json
  else
    FinancialTransaction.all.to_json
  end
end

put '/transactions/:id' do
  data = JSON.parse(request.body.read)
  
  f = FinancialTransaction.where(plaid_id: data['plaid_id']).first
  f.uploaded = data['uploaded']
  f.spreadsheet_name = data['spreadsheet_name']
  f.category = data['category']
  f.hidden = data['hidden']
  f.save!

  status 204
  body ''
end

post '/transactions/batch_upload' do
  post_data = JSON.parse(request.body.read)

  post_data['transactions'].each do |data|
    next if FinancialTransaction.where(plaid_id: data['id']).any?
    
    f = FinancialTransaction.find_or_initialize_by(plaid_id: data['id'])
    f.transacted_at = data['date']
    f.plaid_name = data['name']
    f.amount = data['amount']
    f.source = data['type']
    f.save!
  end

  status 204
  body ''
end

