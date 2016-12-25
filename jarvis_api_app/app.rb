require 'sinatra'

require_relative '../lib/plaid/api'

set :bind, '0.0.0.0'

set :logging, true

get '/bank/institutions' do
  api = Plaid::Api.new

  content_type :json

  api.institutions.to_json
end

get '/bank/:bank' do
  bank = params[:bank]

  api = Plaid::Api.new

  content_type :json

  api.transactions(bank).to_json
end

get '/bank/:bank/balance' do
  bank = params[:bank]

  api = Plaid::Api.new

  content_type :json

  api.balance(bank).to_json
end
