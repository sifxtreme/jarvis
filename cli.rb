require_relative './plaid/api'
require_relative './google_drive/api'

plaid = Plaid::Api.new
spreadsheet = FinanceSpreadsheet::Api.new

plaid.sync_all
spreadsheet.sync_to_drive
spreadsheet.sync_from_drive