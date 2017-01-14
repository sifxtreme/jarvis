require_relative './app/lib/plaid/api'
require_relative './app/lib/google_drive/api'

plaid = Plaid::Api.new
spreadsheet = FinanceSpreadsheet::Api.new

pull_down = ARGV[0]

if pull_down == 'sync_to_drive'
  plaid.sync_all
  spreadsheet.sync_to_drive
elsif pull_down == 'sync_from_drive'
  spreadsheet.sync_from_drive
end

spreadsheet.sync_from_drive
