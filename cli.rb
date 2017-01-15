require_relative './app/lib/plaid/api'
require_relative './app/lib/google_drive/api'
require_relative './app/lib/southwest/search'

plaid = Plaid::Api.new
spreadsheet = FinanceSpreadsheet::Api.new
southwest = Southwest.new

arg = ARGV[0]

if arg == 'sync_to_drive'
  plaid.sync_all
  spreadsheet.sync_to_drive

elsif arg == 'sync_from_drive'
  spreadsheet.sync_from_drive

elsif arg == 'southwest'
  southwest.runner
  
end
