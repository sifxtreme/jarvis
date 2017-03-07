require 'pry'
require 'rest-client'
require 'json'

require 'google_drive'

require_relative '../../db/models/financial_transaction'
require_relative './google_session_config'

require_relative '../utils'

module FinanceSpreadsheet

  class SheetNotFoundError < StandardError

  end

  class Api

    include Utils
    
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

    # uploaded transactions from database to google spreadsheet
    def sync_to_drive
      begin
        are_all_sheets_created?
      rescue SheetNotFoundError => e
        JarvisLogger.logger.warn e.message
        return
      end

      transactions = FinancialTransaction.
        where(uploaded: false).
        order(:transacted_at)
      
      transactions.each do |transaction|
        submit_transaction_to_sheet(transaction)
        marked_transaction_as_uploaded(transaction)
      end
    end

    # sync name and category from google spreadsheet
    def sync_from_drive
      transactions = FinancialTransaction.
        where(downloaded: false)

      transactions.each do |transaction|
        begin
          data = get_spreadsheet_data_for(transaction)
          save_metadata_to_database(data, transaction)
        rescue StandardError => e
          JarvisLogger.logger.error e.message
        end
      end
    end

    def submit_transaction_to_sheet(transaction)
      worksheet = worksheet_for_date_of(transaction)

      last_row = worksheet.num_rows + 1

      # do we have enough rows?
      if (worksheet.max_rows - worksheet.num_rows) < 5
        worksheet.max_rows += 5
      end
      
      worksheet[last_row, NAME_COLUMN] = transaction[:spreadsheet_name] || transaction[:plaid_name]
      worksheet[last_row, CATEGORY_COLUMN] = transaction[:category]
      worksheet[last_row, AMOUNT_COLUMN] = transaction[:amount]
      worksheet[last_row, ID_COLUMN] = transaction[:id]

      worksheet.save
    end

    def get_spreadsheet_data_for(transaction)
      worksheet = worksheet_for_date_of(transaction)
      
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

    def marked_transaction_as_uploaded(transaction)
      transaction.uploaded = true
      transaction.save!

      JarvisLogger.logger.info("TRANSACTION #{transaction['id']} UPLOADED: #{transaction['plaid_name']}")
    end

    def save_metadata_to_database(data, transaction)
      transaction.spreadsheet_name = data[:spreadsheet_name]
      transaction.category = data[:category]
      transaction.hidden = data[:hidden]
      transaction.downloaded = true
      transaction.save!

      JarvisLogger.logger.info("METADATA #{transaction['id']} SYNCED: #{transaction['spreadsheet_name'] || transaction['plaid_name']}")
    end

    private

    def worksheet_for_date_of(transaction)
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
