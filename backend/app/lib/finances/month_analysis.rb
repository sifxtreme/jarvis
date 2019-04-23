class Finances::MonthAnalysis

  include Utils

  def month_snapshot(target_month = month, target_year = year)
    {
      total: total_spent_in_month(target_month, target_year),
      all_categories: all_categories(target_month, target_year),
      uncategorized_records: uncategorized_records(target_month, target_year)
    }
  end

  private

  def total_spent_in_month(target_month, target_year)
    total_query = FinancialTransaction.select('sum(amount) as total')
                                      .where(hidden: 0)
                                      .where('YEAR(transacted_at) = ?', target_year)
                                      .where('MONTH(transacted_at) = ?', target_month)

    total_query.first.total
  end

  def all_categories(target_month, target_year)
    @all_categories ||= FinancialTransaction.select('category, sum(amount) as total')
                                            .where(hidden: 0)
                                            .where('YEAR(transacted_at) = ?', target_year)
                                            .where('MONTH(transacted_at) = ?', target_month)
                                            .group('YEAR(transacted_at), MONTH(transacted_at), category')
                                            .order('sum(amount) desc')
  end

  def uncategorized_records(target_month, target_year)
    @uncategorized_records ||= FinancialTransaction.select(:plaid_name, :amount)
                                                   .where(hidden: 0)
                                                   .where('category is NULL')
                                                   .where('YEAR(transacted_at) = ?', target_year)
                                                   .where('MONTH(transacted_at) = ?', target_month)
                                                   .order('amount desc')
  end

end
