require "google_drive"
require 'pry'

require_relative './google_session_config'

class GoogleDriveSpreadsheetApi

  def runner
    config = CustomConfig.new

    session = GoogleDrive::Session.from_config(config)

    spreadsheet = session.spreadsheet_by_title('Budget_Play')

    ws = spreadsheet.worksheets.select {|x| x.title == 'Yearly'}.first

    ws.save
  end
  
  def normalize_price(price)
    return 0 if price.nil?
    price.gsub(/[$,]/, "").to_f.round(2)
  end

  def processing
    places = {}

    spreadsheet_id = '1x36xpb1To2hF4J_evUz6DG-SDiZCc-lBwN8YbmgGq24'

    spreadsheet_range = '!A5:C'
    sheets = ['Feb 2015','March 2015','April 2015','May 2015','June 2015','July 2015','Aug 2015','Sept 2015','Oct 2015','Nov 2015','Dec 2015','Jan 2016','Feb 2016','March 2016','April 2016','May 2016','June 2016']

    sheets.each do |sheet|
      range = "#{sheet}#{spreadsheet_range}"
      response = service.get_spreadsheet_values(spreadsheet_id, range)

      response.values.each do |row|
        key = row[0]
        if row[2] && row[2].include?('500')
          puts "#{sheet}: #{row[0]}"
        end
        if places[key]
          places[key][:count] = places[key][:count] + 1
          places[key][:amount] = (places[key][:amount] + normalize_price(row[2])).round(2)
        else
          places[key] = {:count => 1, :amount => normalize_price(row[2])}
        end
      end
    end
  end




end

GoogleDriveSpreadsheetApi.new.runner
