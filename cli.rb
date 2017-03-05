require 'pry'

require_relative './app/lib/plaid/api'
require_relative './app/lib/google_drive/api'
require_relative './app/lib/southwest/search'
require_relative './app/lib/analysis/finances'
require_relative './app/lib/reddit/newsletter'

arg = ARGV[0]

begin
  
  if arg == 'sync_to_drive'
    Plaid::Api.new.sync_all
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


require_relative './app/db/models/financial_transaction'

categories = {}
names = {}

finances = FinancialTransaction.where(hidden: 0).
      where("spreadsheet_name is not NULL")


def titleize(x)
  "#{x.split.each{|x| x.capitalize!}.join(' ')}"
end

def translate_plaid_name(f)
  tmp = f.plaid_name.
    split(" ").
    delete_if { |a| a.count("0-9") > 2 }

  tmp.pop if tmp.last.count("0-9") > 0
    
  titleize(tmp.join(" "))
end

finances.each do |f|
  if categories[translate_plaid_name(f)]
    if categories[translate_plaid_name(f)][f.category]
      categories[translate_plaid_name(f)][f.category] = categories[translate_plaid_name(f)][f.category] + 1
    else
      categories[translate_plaid_name(f)][f.category] = 1
    end
  else
    categories[translate_plaid_name(f)] = {
      "#{f.category}" => 1
    }
  end

  if names[translate_plaid_name(f)]
    if names[translate_plaid_name(f)][f.spreadsheet_name]
      names[translate_plaid_name(f)][f.spreadsheet_name] = names[translate_plaid_name(f)][f.spreadsheet_name] + 1
    else
      names[translate_plaid_name(f)][f.spreadsheet_name] = 1
    end
  else
    names[translate_plaid_name(f)] = {
      "#{f.spreadsheet_name}" => 1
    }
  end
end

names = Hash[names.sort]
categories = Hash[categories.sort]

problematic_names = names.select {|k,v| v.size > 1}
problematic_categories = categories.select {|k,v| v.size > 1}

puts problematic_names.count
puts problematic_categories.count

puts problematic_names.to_json
puts problematic_categories.to_json