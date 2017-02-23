require 'sinatra'
require 'sinatra/activerecord'
require 'rufus-scheduler'
require 'pry'

set :bind, '0.0.0.0'

set :database_file, "./db/database.yml"

set :logging, true

require_relative './db/models/financial_transaction'

require_relative './log/logger'
require_relative './lib/plaid/api'
require_relative './lib/google_drive/api'
require_relative './lib/southwest/search'
require_relative './lib/analysis/finances'


class JarvisApp < Sinatra::Base

  configure do

    enable :logging
    file = File.new("#{File.dirname(__FILE__)}/log/app.log", 'a+')
    file.sync = true
    use Rack::CommonLogger, file

    scheduler = Rufus::Scheduler.new

    scheduler.cron '0 14 * * *' do
      plaid = Plaid::Api.new
      spreadsheet = FinanceSpreadsheet::Api.new
      
      plaid.sync_all
      spreadsheet.sync_to_drive
    end

    scheduler.cron '0 15 * * *' do
      Analysis::Finances.new.email_report
    end

    scheduler.cron '30 */3 * * *' do
      Southwest.new.runner
    end

    # scheduler.join
    # let the current thread join the scheduler thread
  end

  get '/transactions/' do
    content_type :json
    FinancialTransaction.all.to_json
  end

end
