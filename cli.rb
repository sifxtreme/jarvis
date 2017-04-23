require 'pry'

require_relative './app/lib/plaid/api'
require_relative './app/lib/google_drive/api'
require_relative './app/lib/southwest/search'
require_relative './app/lib/analysis/finances'
require_relative './app/lib/reddit/newsletter'

arg = ARGV[0]

begin
  
  if arg == 'sync_to_db'
    Plaid::Api.new.sync_all

  elsif arg == 'sync_analysis'
    Analysis::Finances.new.analyze_new_transactions
    
  elsif arg == 'sync_to_drive'
    FinanceSpreadsheet::Api.new.sync_to_drive

  elsif arg == 'sync_from_drive'
    FinanceSpreadsheet::Api.new.sync_from_drive

  elsif arg == 'southwest'
    Southwest.new.runner

  elsif arg == 'email'
    Analysis::Finances.new.email_report

  elsif arg == 'reddit'
    Reddit::Newsletter.new.email_report

  end

rescue StandardError => e
  puts e.message
end
