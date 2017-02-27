require 'sinatra'
require 'sinatra/activerecord'
require 'pry'

set :bind, '0.0.0.0'

set :database_file, "./db/database.yml"

set :logging, true

require_relative './db/models/financial_transaction'
require_relative './db/models/weather'

require_relative './log/logger'
require_relative './lib/plaid/api'
require_relative './lib/google_drive/api'
require_relative './lib/southwest/search'
require_relative './lib/analysis/finances'
require_relative './lib/analysis/weather'
require_relative './lib/reddit/newsletter'


get '/weather/:attribute' do
  erb :weather
end

get '/api/transactions' do
  content_type :json
  FinancialTransaction.all.to_json
end

get '/api/weather/:attribute' do
  content_type :json

  cities = ["Austin", "Los Angeles", "Albuquerque"]

  attribute = params[:attribute]

  data = {cities: {}}

  cities.each do |city|
    city_data = Analysis::Weather.new.runner(city, attribute)
    data[:dates] = city_data[:keys]
    data[:cities][city] = city_data[:values]
  end

  data.to_json
end
