class FinancialTransactionsController < ApplicationController

  def index
    year = params[:year]
    month = params[:month]
    query = params[:query]
    show_hidden = params[:show_hidden]
    show_needs_review = params[:show_needs_review]
    columns = [:id, :plaid_id, :plaid_name, :merchant_name, :category, :source, :amount, :transacted_at, :created_at,
               :updated_at, :hidden, :reviewed, :amortized_months]
    columns << :raw_data if params[:include_raw_data] == 'true'
    db_query = FinancialTransaction.select(columns).all
    if year && year != 'null'
      db_query = db_query.where('extract(year from transacted_at) = ?', year)
    end
    if month && month != 'null'
      current_year_month = "#{year}-#{month.rjust(2, '0')}"
      db_query = db_query.where('extract(month from transacted_at) = ? OR ? = ANY(amortized_months)', month, current_year_month)
    end
    db_query = db_query.where('category ilike ? or merchant_name ilike ? or plaid_name ilike ? or source ilike ?', "%#{query}%", "%#{query}%", "%#{query}%", "%#{query}%") if query
    db_query = db_query.where('hidden is true') if show_hidden == 'true'
    db_query = db_query.where('hidden is false') if show_hidden == 'false'
    db_query = db_query.where('reviewed is false') if show_needs_review == 'true'
    db_query = db_query.order('transacted_at DESC, id DESC')

    transactions = db_query.map
    if month
      current_year_month = "#{year}-#{month.rjust(2, '0')}"
      transactions.each do |transaction|
        if transaction.amortized_months.present? && transaction.amortized_months.include?(current_year_month)
          transaction.amount = transaction.amount / transaction.amortized_months.length
        end
      end
    end

    render json: { results: transactions }
  end

  def create
    data = JSON.parse(request.body.read)

    f = FinancialTransaction.new
    f.plaid_id = data['plaid_id']
    f.plaid_name = data['merchant_name']
    f.merchant_name = data['merchant_name']
    f.category = data['category']
    f.amount = data['amount']
    f.transacted_at = get_date(data['transacted_at'])
    f.source = data['source']
    f.hidden = data['hidden'] || false
    f.reviewed = true
    f.save!

    render json: f
  end

  def update
    data = JSON.parse(request.body.read)

    f = FinancialTransaction.find(params[:id])
    f.merchant_name = data['merchant_name'] if data.key?('merchant_name')
    f.category = data['category'] if data.key?('category')
    f.amount = data['amount'] if data.key?('amount')
    f.transacted_at = get_date(data['transacted_at']) if data.key?('transacted_at')
    f.source = data['source'] if data.key?('source')
    f.hidden = data.key?('hidden') ? data['hidden'] : f.hidden
    f.reviewed = true
    f.save!

    render json: f
  end

  def trends
    year = (params[:year] || Date.current.year).to_i
    category_filter = params[:category]

    base_scope = FinancialTransaction
      .where('extract(year from transacted_at) = ?', year)
      .where(hidden: false)
      .where("category NOT ILIKE '%income%' OR category IS NULL")

    base_scope = base_scope.where(category: category_filter) if category_filter.present?

    render json: {
      period: period_summary(base_scope, year),
      monthly_totals: monthly_breakdown(base_scope),
      by_category: category_breakdown(base_scope),
      by_merchant: merchant_breakdown(base_scope),
      budget_comparison: budget_comparison(base_scope, year),
      monthly_by_category: monthly_by_category(base_scope),
      monthly_by_merchant: monthly_by_merchant(base_scope)
    }
  end

  def recurring_status
    year = (params[:year] || Date.current.year).to_i
    month = (params[:month] || Date.current.month).to_i
    current_date = Date.new(year, month, 1)
    today = Date.today
    current_day = today.day

    # Get last 12 full months (not including current month)
    end_of_last_month = current_date - 1.day
    start_of_period = (current_date - 12.months)

    # Get all transactions from the last 12 full months (including income)
    historical = FinancialTransaction
      .where('transacted_at >= ? AND transacted_at <= ?', start_of_period, end_of_last_month)
      .where(hidden: false)
      .where('amount != 0')

    # Group by merchant identifier
    grouped = historical.group_by { |t| merchant_key(t) }

    # Find recurring patterns (9+ months out of 12)
    recurring_patterns = []

    grouped.each do |merchant_key, transactions|
      next if merchant_key.blank?

      # Count unique months
      months = transactions.map { |t| t.transacted_at.strftime('%Y-%m') }.uniq
      next if months.length < 9

      # Calculate statistics
      days = transactions.map { |t| t.transacted_at.day }
      latest_transaction = transactions.max_by(&:transacted_at)

      typical_day = median(days).round
      typical_amount = latest_transaction.amount.to_f.abs.round(2)

      # Get most common source and category
      sources = transactions.map(&:source).compact
      categories = transactions.map(&:category).compact
      typical_source = mode(sources)
      typical_category = mode(categories)

      # Get the display name (prefer merchant_name if available, else plaid_name)
      sample = transactions.first
      display_name = sample.merchant_name.presence || sample.plaid_name

      is_income = typical_category&.downcase&.include?('income') || latest_transaction.amount.to_f < 0

      recurring_patterns << {
        merchant_key: merchant_key,
        display_name: display_name,
        plaid_name: sample.plaid_name,
        merchant_name: sample.merchant_name,
        typical_day: typical_day,
        typical_amount: typical_amount,
        source: typical_source,
        category: typical_category,
        months_present: months.length,
        last_occurrence: latest_transaction.transacted_at.to_date.iso8601,
        is_income: is_income
      }
    end

    # Check which are present in current month
    current_month_transactions = FinancialTransaction
      .where('extract(year from transacted_at) = ? AND extract(month from transacted_at) = ?', year, month)
      .where(hidden: false)

    current_month_keys = current_month_transactions.map { |t| merchant_key(t) }.compact.uniq

    # Categorize as missing or present
    missing = []
    present = []

    recurring_patterns.each do |pattern|
      is_present = current_month_keys.include?(pattern[:merchant_key])

      if is_present
        present << pattern
      else
        # Calculate status based on typical day vs current day
        if current_day > pattern[:typical_day]
          days_overdue = current_day - pattern[:typical_day]
          pattern[:status] = 'overdue'
          pattern[:days_difference] = days_overdue
        else
          days_until = pattern[:typical_day] - current_day
          pattern[:status] = days_until <= 3 ? 'due_soon' : 'upcoming'
          pattern[:days_difference] = days_until
        end

        missing << pattern
      end
    end

    # Sort missing: overdue first (by days overdue desc), then upcoming (by days until asc)
    missing.sort_by! do |p|
      if p[:status] == 'overdue'
        [0, -p[:days_difference]]
      else
        [1, p[:days_difference]]
      end
    end

    render json: {
      year: year,
      month: month,
      current_day: current_day,
      missing: missing,
      present: present
    }
  end

  private

  def period_summary(scope, year)
    expenses = scope.where('amount > 0')
    income = scope.where('amount < 0')

    {
      year: year,
      total_transactions: scope.count,
      total_spent: expenses.sum(:amount).to_f.round(2),
      total_income: income.sum(:amount).to_f.abs.round(2),
      net_savings: (income.sum(:amount).abs - expenses.sum(:amount)).to_f.round(2)
    }
  end

  def monthly_breakdown(scope)
    scope
      .where('amount > 0')
      .group("to_char(transacted_at, 'YYYY-MM')")
      .select(
        "to_char(transacted_at, 'YYYY-MM') as month",
        "SUM(amount) as spent",
        "COUNT(*) as transaction_count"
      )
      .order('month')
      .map do |row|
        {
          month: row.month,
          spent: row.spent.to_f.round(2),
          transaction_count: row.transaction_count
        }
      end
  end

  def category_breakdown(scope)
    totals = scope
      .where('amount > 0')
      .where.not(category: [nil, ''])
      .group(:category)
      .select(
        "category",
        "SUM(amount) as total",
        "COUNT(*) as transaction_count"
      )
      .order('total DESC')
      .limit(20)

    budgets = Budget.where(expense_type: 'expense').index_by(&:name)

    totals.map do |row|
      budget = budgets[row.category]
      budget_amount = budget&.amount&.to_f || 0
      annual_budget = budget_amount * 12
      variance = annual_budget > 0 ? annual_budget - row.total.to_f : nil

      {
        category: row.category,
        total: row.total.to_f.round(2),
        transaction_count: row.transaction_count,
        budget: annual_budget.round(2),
        variance: variance&.round(2),
        monthly_avg: (row.total.to_f / 12).round(2)
      }
    end
  end

  def merchant_breakdown(scope)
    scope
      .where('amount > 0')
      .where.not(plaid_name: [nil, ''])
      .group(:plaid_name)
      .select(
        "plaid_name as merchant",
        "SUM(amount) as total",
        "COUNT(*) as transaction_count",
        "array_agg(DISTINCT category) as categories",
        "MAX(transacted_at) as last_transaction"
      )
      .order('total DESC')
      .limit(15)
      .map do |row|
        {
          merchant: row.merchant,
          total: row.total.to_f.round(2),
          transaction_count: row.transaction_count,
          categories: row.categories.compact.uniq,
          last_transaction: row.last_transaction&.to_date&.iso8601
        }
      end
  end

  def budget_comparison(scope, year)
    actuals = scope
      .where('amount > 0')
      .where.not(category: [nil, ''])
      .group(:category)
      .sum(:amount)

    Budget.where(expense_type: 'expense').map do |budget|
      actual = actuals[budget.name]&.to_f || 0
      annual_budget = budget.amount.to_f * 12
      variance = annual_budget - actual

      {
        category: budget.name,
        budget: annual_budget.round(2),
        actual: actual.round(2),
        variance: variance.round(2),
        variance_percent: annual_budget > 0 ? ((variance / annual_budget) * 100).round(1) : 0,
        on_track: variance >= 0
      }
    end.sort_by { |b| b[:variance] }
  end

  def monthly_by_category(scope)
    # Get top 10 categories by total spend
    top_categories = scope
      .where('amount > 0')
      .where.not(category: [nil, ''])
      .group(:category)
      .order('SUM(amount) DESC')
      .limit(10)
      .pluck(:category)

    # Get monthly data for those categories
    data = scope
      .where('amount > 0')
      .where(category: top_categories)
      .group(:category, "to_char(transacted_at, 'YYYY-MM')")
      .select(
        "category",
        "to_char(transacted_at, 'YYYY-MM') as month",
        "SUM(amount) as total"
      )

    # Organize by category
    result = {}
    data.each do |row|
      result[row.category] ||= []
      result[row.category] << { month: row.month, total: row.total.to_f.round(2) }
    end

    # Sort each category's months and return
    result.map do |category, months|
      {
        category: category,
        months: months.sort_by { |m| m[:month] }
      }
    end.sort_by { |c| -c[:months].sum { |m| m[:total] } }
  end

  def monthly_by_merchant(scope)
    # Get top 10 merchants by total spend (using plaid_name)
    top_merchants = scope
      .where('amount > 0')
      .where.not(plaid_name: [nil, ''])
      .group(:plaid_name)
      .order('SUM(amount) DESC')
      .limit(10)
      .pluck(:plaid_name)

    # Get monthly data for those merchants
    data = scope
      .where('amount > 0')
      .where(plaid_name: top_merchants)
      .group(:plaid_name, "to_char(transacted_at, 'YYYY-MM')")
      .select(
        "plaid_name as merchant",
        "to_char(transacted_at, 'YYYY-MM') as month",
        "SUM(amount) as total",
        "COUNT(*) as transaction_count"
      )

    # Organize by merchant
    result = {}
    data.each do |row|
      result[row.merchant] ||= []
      result[row.merchant] << { month: row.month, total: row.total.to_f.round(2), transaction_count: row.transaction_count }
    end

    # Sort each merchant's months and return
    result.map do |merchant, months|
      {
        merchant: merchant,
        months: months.sort_by { |m| m[:month] }
      }
    end.sort_by { |m| -m[:months].sum { |mo| mo[:total] } }
  end

  def get_date(date_param)
    Date.parse(date_param)
  rescue StandardError
    Date.today
  end

  def merchant_key(transaction)
    # Use plaid_name as the primary key, fall back to merchant_name
    transaction.plaid_name.presence || transaction.merchant_name.presence
  end

  def median(array)
    return 0 if array.empty?
    sorted = array.sort
    mid = sorted.length / 2
    sorted.length.odd? ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0
  end

  def mode(array)
    return nil if array.empty?
    array.group_by(&:itself).max_by { |_, v| v.length }&.first
  end

end
