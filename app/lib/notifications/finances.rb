module Notifications
  class Finances

    include Utils

    def daily_report
      finances_email = FinancesMailer.daily_report(total, all_categories, uncategorized_records)
      finances_email.deliver_now
    end

    private

    def total
      total_query = FinancialTransaction.select("sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month)

      total_query.first.total

    end

    def all_categories
      @all_categories ||= FinancialTransaction.select("category, sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month).
          group("YEAR(transacted_at), MONTH(transacted_at), category")  
    end

    def uncategorized_records
      @uncategorized_records ||= FinancialTransaction.select(:plaid_name, :amount).
        where(hidden: 0).
        where('category is NULL').
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month)
    end
    
  end
end
