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
    DATABASE_API_TRANSACTIONS_URL = "#{DATABASE_API_BASE_URL}/transactions"

    attr_accessor :worksheets

    NAME_COLUMN = 1
    CATEGORY_COLUMN = 2
    AMOUNT_COLUMN = 3
    PLAID_ID_COLUMN = 4

    def initialize
      config = GoogleSessionConfig.new

      session = GoogleDrive::Session.from_config(config)

      spreadsheet = session.spreadsheet_by_title(SPREADSHEET_NAME)
      @worksheets = spreadsheet.worksheets
    end

    def sync_to_drive
      begin
        are_all_sheets_created?
      rescue SheetNotFoundError => e
        print e.message
      end

      transaction_response = RestClient.get("#{DATABASE_API_TRANSACTIONS_URL}/?sync_to_drive=true")
      transactions = JSON.parse(transaction_response)
      
      transactions.each do |transaction|
        submit_transaction_to_sheet(transaction)
        marked_transaction_as_uploaded(transaction)
      end
    end

    def sync_from_drive
      transaction_response = RestClient.get("#{DATABASE_API_TRANSACTIONS_URL}/?sync_from_drive=true")
      transactions = JSON.parse(transaction_response)

      transactions.each do |transaction|
        data = get_transaction_date_from_spreadsheet(transaction)
        submit_metadata_to_database(data, transaction)
      end
    end

    def submit_transaction_to_sheet(transaction)
      worksheet = worksheet_for_date(transaction)

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

    def get_transaction_date_from_spreadsheet(transaction)
      worksheet = worksheet_for_date(transaction)
      
      (1..worksheet.num_rows).each do |row_number|
        if worksheet[row_number, PLAID_ID_COLUMN] == transaction['plaid_id']
          return {
            spreadsheet_name: worksheet[row_number, NAME_COLUMN],
            category: worksheet[row_number, CATEGORY_COLUMN],
            hidden: false
          }
        end
      end

      return {hidden: true}
    end

    def marked_transaction_as_uploaded(transaction, data = nil)
      headers = {content_type: :json, accept: :json}
      data_to_send = transaction.merge({uploaded:  true}).merge(data)
      RestClient.put "#{DATABASE_API_TRANSACTIONS_URL}/#{transaction['id']}", data_to_send.to_json, headers

      print("TRANSACTION #{transaction['id']} UPLOADED: #{transaction['plaid_name']}\n")
    end

    def submit_metadata_to_database(data, transaction)
      headers = {content_type: :json, accept: :json}
      data_to_send = transaction.merge({uploaded: true}).merge(data)
      RestClient.put "#{DATABASE_API_TRANSACTIONS_URL}/#{transaction['id']}", data_to_send.to_json, headers

      print("METADATA #{transaction['id']} SYNCED: #{transaction['spreadsheet_name'] || transaction['plaid_name']}\n")
    end

    def already_found_transactions(transactions)
      already_record_transactions = []

      transactions.each do |transaction|
        if transaction_found?(transaction)
          already_record_transactions << transaction
        end
      end

      already_record_transactions
    end

    def transaction_found?(transaction)
      worksheet = worksheet_for_date(transaction)

      (1..worksheet.num_rows).each do |row_number|
        if worksheet[row_number, AMOUNT_COLUMN].gsub('$', '').to_f == transaction['amount'].to_f
          return true
        end
      end

      false
    end

    private

    def worksheet_for_date(transaction)
      date_of_transaction = DateTime.parse(transaction['transacted_at'])

      worksheets.select do |ws|
        ws.title.include?(date_of_transaction.strftime("%b")) && 
          ws.title.include?(date_of_transaction.strftime("%Y"))
      end.first
    end

    def are_all_sheets_created?
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
