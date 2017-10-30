module Finances
  class Budget

    include Utils

    ROLLING_CATEGORIES = [
      {
        name: "Asif",
        date: "2017-08-01",
        amount: -321.73,
        monthly_budget: 100
      },
      {
        name: "Hafsa",
        date: "2017-08-01",
        amount: -70.77,
        monthly_budget: 100
      }
    ]

    def current_budget_for_rolling_categories
      ROLLING_CATEGORIES.map do |c|
        cutoff_date = Date.parse(c[:date]) # this is the date we stopped tracking in excel

        amount_spent = FinancialTransaction.select("sum(amount) as total").
          where(hidden: 0).
          where(category: c[:name]).
          where("transacted_at >= ?", cutoff_date)

        months = month_difference(cutoff_date, DateTime.now)

        puts amount_spent.first.total
        puts months

        current_budget = c[:amount] - amount_spent.first.total + (months * c[:monthly_budget])

        [c[:name], current_budget.to_f]
      end.to_h
    end

  end
end