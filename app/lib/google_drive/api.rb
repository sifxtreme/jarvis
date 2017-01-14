require 'pry'
require 'rest-client'
require 'json'

require 'google_drive'

require_relative '../../db/models/financial_transaction'
require_relative './google_session_config'

module FinanceSpreadsheet

  class SheetNotFoundError < StandardError

  end

  class Api
    
    SPREADSHEET_NAME = 'Budget'

    attr_accessor :worksheets

    NAME_COLUMN = 1
    CATEGORY_COLUMN = 2
    AMOUNT_COLUMN = 3
    ID_COLUMN = 4

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
        j_log.warn e.message
      end

      transactions = FinancialTransaction.
        select(:id, :plaid_name, :amount, :transacted_at).
        where(uploaded: false).
        order(:transacted_at)
      
      transactions.each do |transaction|
        submit_transaction_to_sheet(transaction)
        marked_transaction_as_uploaded(transaction)
      end
    end

    def sync_from_drive
      transactions = FinancialTransaction.
        select(:id, :plaid_name, :amount, :transacted_at).
        where('transacted_at >= ?', '2016-11-01 00:00:00').
        where('spreadsheet_name IS NULL').
        where(uploaded: true).
        where(hidden: [false, nil]).
        order(:transacted_at)

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
      
      plaid_name = transaction[:plaid_name].gsub(/\w+/) {|w| w.capitalize}
      
      worksheet[last_row, NAME_COLUMN] = plaid_name
      worksheet[last_row, AMOUNT_COLUMN] = transaction[:amount]
      worksheet[last_row, ID_COLUMN] = transaction[:id]

      worksheet.save
    end

    def get_transaction_date_from_spreadsheet(transaction)
      worksheet = worksheet_for_date(transaction)
      
      (1..worksheet.num_rows).each do |row_number|
        if worksheet[row_number, ID_COLUMN] == transaction[:id].to_s
          return {
            spreadsheet_name: worksheet[row_number, NAME_COLUMN],
            category: worksheet[row_number, CATEGORY_COLUMN],
            hidden: false
          }
        end
      end

      return {hidden: true}
    end

    def marked_transaction_as_uploaded(transaction, data = {})
      transaction = FinancialTransaction.find(transaction[:id])
      transaction.uploaded = true
      transaction.save!

      j_log.info("TRANSACTION #{transaction['id']} UPLOADED: #{transaction['plaid_name']}")
    end

    def submit_metadata_to_database(data, transaction)
      transaction = FinancialTransaction.find(transaction[:id])
      transaction.spreadsheet_name = data[:spreadsheet_name]
      transaction.category = data[:category]
      transaction.hidden = data[:hidden]
      transaction.save!

      j_log.info("METADATA #{transaction['id']} SYNCED: #{transaction['spreadsheet_name'] || transaction['plaid_name']}")
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

    def j_log
      JarvisLogger.logger
    end

    def worksheet_for_date(transaction)
      date_of_transaction = transaction[:transacted_at]

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
