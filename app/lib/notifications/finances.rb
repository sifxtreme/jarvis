module Notifications
  class Finances

    include Utils

    def daily_report
      finances_email = FinancesMailer.daily_report(total, all_categories, uncategorized_records)
      finances_email.deliver_now
    end

    def month_snapshot(target_month = month, target_year = year)
      {
        total: total(target_month, target_year),
        all_categories: all_categories(target_month, target_year),
        uncategorized_records: uncategorized_records(target_month, target_year),
      }
    end

    private

    def total(target_month, target_year)
      total_query = FinancialTransaction.select("sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", target_year).
        where("MONTH(transacted_at) = ?", target_month)

      total_query.first.total
    end

    def all_categories(target_month, target_year)
      @all_categories ||= FinancialTransaction.select("category, sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", target_year).
        where("MONTH(transacted_at) = ?", target_month).
          group("YEAR(transacted_at), MONTH(transacted_at), category")  
    end

    def uncategorized_records(target_month, target_year)
      @uncategorized_records ||= FinancialTransaction.select(:plaid_name, :amount).
        where(hidden: 0).
        where('category is NULL').
        where("YEAR(transacted_at) = ?", target_year).
        where("MONTH(transacted_at) = ?", target_month)
    end
    
  end
end
