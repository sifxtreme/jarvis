require 'sinatra'
require 'rufus-scheduler'

set :bind, '0.0.0.0'

set :logging, true

require_relative '../logs/logger'
require_relative '../lib/plaid/api'
require_relative '../lib/google_drive/api'

class SchedulerApp < Sinatra::Base

  configure do

    scheduler = Rufus::Scheduler.new

    plaid = Plaid::Api.new
    spreadsheet = FinanceSpreadsheet::Api.new

    scheduler.cron '0 14 * * *' do
      plaid.sync_all
      spreadsheet.sync_to_drive
    end

    scheduler.join
    # let the current thread join the scheduler thread
  end

end
