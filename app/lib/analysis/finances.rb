require 'pry'

require_relative '../../db/models/financial_transaction'
require_relative '../notifications/email'

require_relative '../utils'

module Analysis
  class Finances

    include Utils

    def analyzer
      categories = get_categories(finances)
      names = get_names(finances)

      puts categories.to_json
      puts names.to_json

      # find_problematic_predictions(names, categories)
    end

    def predicted_category(plaid_name)
      categories = get_categories(finances)

      predicted_hash = categories[translate_plaid_name(plaid_name)]

      if predicted_hash && predicted_hash.count == 1
        predicted_hash.keys.first
      end
    end

    def predicted_name(plaid_name)
      names = get_names(finances)

      predicted_hash = names[translate_plaid_name(plaid_name)]

      if predicted_hash && predicted_hash.count == 1
        predicted_hash.keys.first
      end
    end

    def find_problematic_predictions(names, categories)
      names = Hash[names.sort]
      categories = Hash[categories.sort]

      problematic_names = names.select {|k,v| v.size > 1}
      problematic_categories = categories.select {|k,v| v.size > 1}

      puts problematic_names.count
      puts problematic_categories.count

      puts problematic_names.to_json
      puts problematic_categories.to_json
    end
  
    def email_report
      message = ""
      
      message << "<pre><div style='font-family: monospace; font-size: 14px'>"

      all_categories.each {|x| message << "<span>#{format_number(x.total)}: #{x.category || "???"}</span><br/>" }

      message << "<p>Uncategorized Records<p>"

      uncategorized_records.each {|x| message << "<span>#{format_number(x.amount)}: #{x.plaid_name}</span><br/>" }

      message << "</div></pre>"

      ::Notifications::Email.new.email({
        subject: "Finances - #{today.strftime('%m/%d/%Y')}",
        body: message,
        to_email: 'asifahmed2011@gmail.com',
        cc: 'hsayyeda@gmail.com'
      })
    end

    private

    def get_categories(finances)
      categories = {}

      finances.each do |f|
        plaid_name = f.plaid_name

        if categories[translate_plaid_name(plaid_name)]
          if categories[translate_plaid_name(plaid_name)][f.category]
            categories[translate_plaid_name(plaid_name)][f.category] += 1
          else
            categories[translate_plaid_name(plaid_name)][f.category] = 1
          end
        else
          categories[translate_plaid_name(plaid_name)] = {"#{f.category}" => 1}
        end
      end

      categories
    end

    def get_names(finances)
      names = {}

      finances.each do |f|
        plaid_name = f.plaid_name

        if names[translate_plaid_name(plaid_name)]
          if names[translate_plaid_name(plaid_name)][f.spreadsheet_name]
            names[translate_plaid_name(plaid_name)][f.spreadsheet_name] += 1
          else
            names[translate_plaid_name(plaid_name)][f.spreadsheet_name] = 1
          end
        else
          names[translate_plaid_name(plaid_name)] = {"#{f.spreadsheet_name}" => 1}
        end
      end

      names
    end

    def finances
      FinancialTransaction.where(hidden: 0).
        where("spreadsheet_name is not NULL")
    end

    def uncategorized_records
      FinancialTransaction.select(:plaid_name, :amount).
        where(hidden: 0).
        where('category is NULL').
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month)
    end

    def all_categories
      FinancialTransaction.select("category, sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month).
          group("YEAR(transacted_at), MONTH(transacted_at), category")  
    end
    
  end
end
