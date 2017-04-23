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
require_relative './lib/reddit/newsletter'


class JarvisApp < Sinatra::Base

  configure do

    enable :logging
    file = File.new("#{File.dirname(__FILE__)}/log/app.log", 'a+')
    file.sync = true
    use Rack::CommonLogger, file

    scheduler = Rufus::Scheduler.new

    scheduler.cron '0 14 * * *' do
      Plaid::Api.new.sync_all
      Analysis::Finances.new.analyze_new_transactions
      FinanceSpreadsheet::Api.new.sync_to_drive
    end

    scheduler.cron '0 15 * * *' do
      Analysis::Finances.new.email_report
    end

    scheduler.cron '30 */3 * * *' do
      Southwest.new.runner
    end

    scheduler.cron '0 7 * * 6' do
      Reddit::Newsletter.new.email_report
    end

    # scheduler.join
    # let the current thread join the scheduler thread
  end

end
