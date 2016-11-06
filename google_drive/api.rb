require 'google_drive'
require 'pry'
require 'rest-client'
require 'json'

require_relative './google_session_config'

module FinanceSpreadsheet

  class SheetNotFoundError < StandardError

  end

  class Api
    
    SPREADSHEET_NAME = 'Budget'
    DATABASE_API_BASE_URL = 'http://localhost:3000'
    DATABASE_API_TRANSACTIONS_URL = "#{DATABASE_API_BASE_URL}/transactions/"

    NAME_COLUMN = 1
    CATEGORY_COLUMN = 2
    AMOUNT_COLUMN = 3
    PLAID_ID_COLUMN = 4

    def initialize
      
    end

    def runner
      config = GoogleSessionConfig.new

      session = GoogleDrive::Session.from_config(config)

      spreadsheet = session.spreadsheet_by_title(SPREADSHEET_NAME)
      worksheets = spreadsheet.worksheets

      yearly_worksheet = worksheets.select {|x| x.title == 'Yearly'}.first

      begin
        are_all_sheets_created?(worksheets)
      rescue SheetNotFoundError => e
        print e.message
      end

      transaction_response = RestClient.get(DATABASE_API_TRANSACTIONS_URL)
      transactions = JSON.parse(transaction_response)

      transactions.each do |transaction|
        submit_transaction_to_sheet(worksheets, transaction)
        marked_transaction_as_uploaded(transaction)
      end

      # puts JSON.pretty_generate(already_found_transactions(transactions, worksheets))
    end

    def submit_transaction_to_sheet(worksheets, transaction)
      date_of_transaction = DateTime.parse(transaction['transacted_at'])

      worksheet = worksheets.select do |ws|
        ws.title.include?(date_of_transaction.strftime("%b")) && 
          ws.title.include?(date_of_transaction.strftime("%Y"))
      end.first

      last_row = worksheet.num_rows + 1

      if (worksheet.max_rows - worksheet.num_rows) < 5
        worksheet.max_rows += 5
      end
      
      plaid_name = transaction['plaid_name'].gsub(/\w+/) {|w| w.capitalize}
      
      worksheet[last_row, NAME_COLUMN] = plaid_name
      worksheet[last_row, AMOUNT_COLUMN] = transaction['amount']
      worksheet[last_row, PLAID_ID_COLUMN] = transaction['plaid_id']

      worksheet.save
    end

    def marked_transaction_as_uploaded(transaction)
      transaction['uploaded'] = true
      headers = {content_type: :json, accept: :json}
      RestClient.put "#{DATABASE_API_TRANSACTIONS_URL}/#{transaction['id']}", transaction.to_json, headers

      print("TRANSACTION #{transaction['id']} UPLOADED: #{transaction['plaid_name']}\n")
    end

    def already_found_transactions(transactions, worksheets)
      already_record_transactions = []

      transactions.each do |transaction|
        if transaction_found?(transaction, worksheets)
          already_record_transactions << transaction
        end
      end

      already_record_transactions
    end

    def transaction_found?(transaction, worksheets)
      date_of_transaction = DateTime.parse(transaction['transacted_at'])

      worksheet = worksheets.select do |ws|
        ws.title.include?(date_of_transaction.strftime("%b")) && 
          ws.title.include?(date_of_transaction.strftime("%Y"))
      end

      worksheet.each do |worksheet|
        (1..worksheet.num_rows).each do |row_number|
          if worksheet[row_number, AMOUNT_COLUMN].gsub('$', '').to_f == transaction['amount'].to_f
            return true
          end
        end
      end

      false
    end

    private

    def are_all_sheets_created?(worksheets)
      beginning_date = Date.parse("2015-01-01")
      now_date = DateTime.now
      date_to_compare = beginning_date
      while date_to_compare < now_date
        month_segment = date_to_compare.strftime("%b")
        year_segment = date_to_compare.strftime("%Y")
        if !worksheets.select {|x| x.title.include?(month_segment) && x.title.include?(year_segment)}.any?
          raise SheetNotFoundError, "#{month_segment} #{year_segment} sheet not found. Please create one"
        end
        date_to_compare = date_to_compare >> 1
      end
    end



  end

end

FinanceSpreadsheet::Api.new.runner
