require 'pry'

require_relative '../../db/models/financial_transaction'
require_relative '../notifications/email'

module Analysis

  class Finances
  
    def email_report

      message = ""
      
      message << "<pre><div style='font-family: monospace; font-size: 14px'>"

      categories.each {|x| message << "<span>#{format_number(x.total)}: #{x.category || "???"}</span><br/>" }

      message << "<p>Uncategorized Records<p>"

      uncategorized_records.each {|x| message << "<span>#{format_number(x.amount)}: #{x.plaid_name}</span><br/>" }

      message << "</div></pre>"

      emailer.email({
        subject: "Finances - #{today.strftime('%m/%d/%Y')}",
        body: message,
        to_email: 'asifahmed2011@gmail.com',
        cc: 'hsayyeda@gmail.com'
      })
    end

    def emailer
      ::Notifications::Email.new
    end

    private

    def uncategorized_records
      FinancialTransaction.select(:plaid_name, :amount).
        where(hidden: 0).
        where('category is NULL').
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month)
    end

    def categories
      FinancialTransaction.select("category, sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month).
          group("YEAR(transacted_at), MONTH(transacted_at), category")  
    end

    def format_number(n)
      ('%.2f' % n).rjust(7, ' ')
    end

    def today
      DateTime.now
    end

    def year
      today.strftime('%Y')
    end

    def month
      today.strftime('%m')
    end
    
  end

end
