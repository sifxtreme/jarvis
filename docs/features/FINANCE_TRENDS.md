# Feature: Finance Trends & Insights

> Visualize spending patterns over time with interactive charts

---

## Product Vision

### The Problem

You track hundreds of transactions monthly, but the current UI only shows raw data. Questions like "Am I spending more on groceries this year?" or "Which merchants are eating my budget?" require mental math or spreadsheet exports.

### The Solution

A dedicated Trends page that transforms transaction data into actionable insights:
- **Where is my money going?** — Category breakdown
- **Is my spending increasing?** — Month-over-month trends
- **Who am I paying most?** — Top merchants
- **Am I staying on budget?** — Budget vs. actual over time

### Design Philosophy

1. **Glanceable** — Key insights visible immediately, no clicking required
2. **Explorable** — Drill down into any data point for transaction details
3. **Contextual** — Compare to budgets and historical data, not just raw numbers
4. **Consistent** — Use existing UI patterns (colors, popovers, tables)

---

## User Stories

### Primary
- As a user, I want to see my spending by category over time so I can identify trends
- As a user, I want to see my top merchants so I know where most of my money goes
- As a user, I want to compare my actual spending to budgets so I know if I'm on track

### Secondary
- As a user, I want to filter trends by date range so I can focus on specific periods
- As a user, I want to click on chart elements to see underlying transactions
- As a user, I want to see income vs. expenses so I understand my net cash flow

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                                                                  │
│   TrendsPage.tsx                                                │
│   ├── DateRangeSelector (year/month pickers)                    │
│   ├── SummaryCards (total spent, vs budget, vs last period)     │
│   ├── SpendingOverTimeChart (line chart by month)               │
│   ├── CategoryBreakdownChart (pie/bar chart)                    │
│   ├── TopMerchantsChart (horizontal bar chart)                  │
│   └── BudgetComparisonChart (grouped bar: budget vs actual)     │
│                                                                  │
│   All charts: Click → Popover with transaction list             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│                                                                  │
│   GET /financial_transactions/trends?year=2025                  │
│   Returns pre-aggregated data (no heavy client-side processing) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Server-Side Aggregation?

The current YearlyBudgetPage fetches 24 requests (transactions + budgets × 12 months) and aggregates client-side. This works but:
- Transfers more data than needed
- Duplicates aggregation logic
- Gets slower with more transactions

For Trends, we'll aggregate server-side:
- Single request with pre-computed summaries
- PostgreSQL does aggregation efficiently
- Response stays small regardless of transaction count

---

## API Design

### Endpoint: `GET /financial_transactions/trends`

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | integer | current year | Year to analyze |
| `compare_year` | integer | null | Optional year for comparison |
| `category` | string | null | Filter to specific category |

**Response:**
```json
{
  "period": {
    "year": 2025,
    "total_transactions": 1247,
    "total_spent": 45678.90,
    "total_income": 52000.00,
    "net_savings": 6321.10
  },

  "monthly_totals": [
    {
      "month": "2025-01",
      "spent": 4523.45,
      "income": 4800.00,
      "transaction_count": 87,
      "top_category": "Groceries"
    },
    { "month": "2025-02", "spent": 3891.23, "income": 4800.00, "transaction_count": 72, "top_category": "Restaurants" }
  ],

  "by_category": [
    {
      "category": "Groceries",
      "total": 8234.56,
      "transaction_count": 145,
      "budget": 8000.00,
      "variance": -234.56,
      "monthly_avg": 686.21
    },
    { "category": "Restaurants", "total": 2892.34, "transaction_count": 67, "budget": 2500.00, "variance": -392.34, "monthly_avg": 241.03 }
  ],

  "by_merchant": [
    {
      "merchant": "Amazon",
      "total": 2567.89,
      "transaction_count": 42,
      "categories": ["Shopping", "Groceries", "Electronics"],
      "last_transaction": "2025-01-15"
    },
    { "merchant": "Costco", "total": 1456.78, "transaction_count": 12, "categories": ["Groceries"], "last_transaction": "2025-01-20" }
  ],

  "budget_comparison": [
    {
      "category": "Groceries",
      "budget": 8000.00,
      "actual": 8234.56,
      "variance": -234.56,
      "variance_percent": -2.9,
      "on_track": false
    }
  ],

  "comparison": null  // Populated if compare_year provided
}
```

### Backend Implementation

```ruby
# app/controllers/financial_transactions_controller.rb

def trends
  year = (params[:year] || Date.current.year).to_i
  compare_year = params[:compare_year]&.to_i
  category_filter = params[:category]

  base_scope = FinancialTransaction
    .where('extract(year from transacted_at) = ?', year)
    .where(hidden: false)

  base_scope = base_scope.where(category: category_filter) if category_filter.present?

  render json: {
    period: period_summary(base_scope, year),
    monthly_totals: monthly_breakdown(base_scope),
    by_category: category_breakdown(base_scope),
    by_merchant: merchant_breakdown(base_scope),
    budget_comparison: budget_comparison(base_scope, year),
    comparison: compare_year ? build_comparison(year, compare_year) : nil
  }
end

private

def period_summary(scope, year)
  expenses = scope.where('amount > 0')
  income = scope.where('amount < 0')  # Income stored as negative

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
    .where('amount > 0')  # Expenses only for spending chart
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
  # Get totals by category
  totals = scope
    .where('amount > 0')
    .where.not(category: [nil, ''])
    .group(:category)
    .select(
      "category",
      "SUM(amount) as total",
      "COUNT(*) as transaction_count",
      "AVG(amount) as avg_amount"
    )
    .order('total DESC')
    .limit(20)

  # Join with budgets
  budgets = Budget.where(expense_type: 'expense').index_by(&:name)

  totals.map do |row|
    budget = budgets[row.category]
    budget_amount = budget&.amount&.to_f || 0
    variance = budget_amount > 0 ? budget_amount - row.total.to_f : nil

    {
      category: row.category,
      total: row.total.to_f.round(2),
      transaction_count: row.transaction_count,
      budget: budget_amount.round(2),
      variance: variance&.round(2),
      monthly_avg: (row.total.to_f / 12).round(2)
    }
  end
end

def merchant_breakdown(scope)
  scope
    .where('amount > 0')
    .group("COALESCE(NULLIF(merchant_name, ''), plaid_name)")
    .select(
      "COALESCE(NULLIF(merchant_name, ''), plaid_name) as merchant",
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
  # Calculate actual spending per category
  actuals = scope
    .where('amount > 0')
    .where.not(category: [nil, ''])
    .group(:category)
    .sum(:amount)

  # Get budgets valid for this year
  Budget.where(expense_type: 'expense').map do |budget|
    actual = actuals[budget.name]&.to_f || 0
    annual_budget = budget.amount.to_f * 12  # Assuming monthly budgets
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
```

---

## Frontend Design

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Trends                                     [2024] [2025 ▼]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Total Spent  │ │ vs Budget    │ │ vs Last Year │             │
│  │   $45,678    │ │   -$1,234    │ │    +12.3%    │             │
│  │              │ │   (over)     │ │   (higher)   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Monthly Spending                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    $5k ┤                                                 │   │
│  │        │      ╭─╮                                        │   │
│  │    $4k ┤   ╭──╯ ╰──╮    ╭──╮                            │   │
│  │        │ ╭─╯       ╰────╯  ╰──╮                         │   │
│  │    $3k ┤─╯                    ╰──                       │   │
│  │        ├────┬────┬────┬────┬────┬────┬────┬────┬────   │   │
│  │        Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                   │
│  By Category                 │  Top Merchants                    │
│  ┌────────────────────────┐  │  ┌────────────────────────────┐  │
│  │ ████████ Groceries 35% │  │  │ Amazon        ████████ $2.5k│  │
│  │ █████ Restaurants 20%  │  │  │ Costco        ██████ $1.8k  │  │
│  │ ████ Shopping 15%      │  │  │ Whole Foods   █████ $1.2k   │  │
│  │ ███ Transport 12%      │  │  │ Target        ████ $0.9k    │  │
│  │ ██ Bills 10%           │  │  │ Starbucks     ███ $0.6k     │  │
│  │ █ Other 8%             │  │  │ ...                         │  │
│  └────────────────────────┘  │  └────────────────────────────┘  │
│                              │                                   │
├──────────────────────────────┴──────────────────────────────────┤
│                                                                  │
│  Budget vs Actual                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Groceries      ████████████████░░ $8.2k / $8k  (-$234)  │   │
│  │ Restaurants    ████████████░░░░░░ $2.9k / $2.5k (-$392) │   │
│  │ Shopping       ██████████░░░░░░░░ $1.8k / $2k   (+$200) │   │
│  │ Transport      ████████░░░░░░░░░░ $1.2k / $1.5k (+$300) │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. SummaryCards

```tsx
// components/trends/SummaryCards.tsx
interface SummaryCardsProps {
  totalSpent: number;
  totalBudget: number;
  lastYearSpent?: number;
}

export function SummaryCards({ totalSpent, totalBudget, lastYearSpent }: SummaryCardsProps) {
  const budgetVariance = totalBudget - totalSpent;
  const yearOverYear = lastYearSpent ? ((totalSpent - lastYearSpent) / lastYearSpent) * 100 : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Spent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono">
            {formatCurrency(totalSpent)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            vs Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold font-mono",
            budgetVariance >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {budgetVariance >= 0 ? '+' : ''}{formatCurrency(budgetVariance)}
          </div>
          <p className="text-sm text-muted-foreground">
            {budgetVariance >= 0 ? 'under budget' : 'over budget'}
          </p>
        </CardContent>
      </Card>

      {yearOverYear !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              vs Last Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold font-mono",
              yearOverYear <= 0 ? "text-green-600" : "text-red-600"
            )}>
              {yearOverYear >= 0 ? '+' : ''}{yearOverYear.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### 2. SpendingOverTimeChart

```tsx
// components/trends/SpendingOverTimeChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyTotal {
  month: string;
  spent: number;
  transaction_count: number;
}

export function SpendingOverTimeChart({ data }: { data: MonthlyTotal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <LineChart data={data}>
            <XAxis
              dataKey="month"
              tickFormatter={(value) => value.slice(5)} // Show "01", "02", etc.
            />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{formatMonth(data.month)}</p>
                    <p className="font-mono">{formatCurrency(data.spent)}</p>
                    <p className="text-sm text-muted-foreground">
                      {data.transaction_count} transactions
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="spent"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

#### 3. CategoryBreakdownChart

```tsx
// components/trends/CategoryBreakdownChart.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function CategoryBreakdownChart({
  data,
  onCategoryClick
}: {
  data: CategoryData[];
  onCategoryClick: (category: string) => void;
}) {
  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>By Category</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center">
        <ChartContainer config={chartConfig} className="h-[250px] w-1/2">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              onClick={(_, index) => onCategoryClick(data[index].category)}
              className="cursor-pointer"
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartContainer>

        {/* Legend */}
        <div className="w-1/2 space-y-2">
          {data.slice(0, 6).map((item, index) => (
            <button
              key={item.category}
              onClick={() => onCategoryClick(item.category)}
              className="flex items-center gap-2 w-full hover:bg-muted p-1 rounded transition-colors"
            >
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="flex-1 text-sm text-left">{item.category}</span>
              <span className="font-mono text-sm">
                {((item.total / total) * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 4. TopMerchantsChart

```tsx
// components/trends/TopMerchantsChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function TopMerchantsChart({
  data,
  onMerchantClick
}: {
  data: MerchantData[];
  onMerchantClick: (merchant: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <BarChart data={data.slice(0, 8)} layout="vertical">
            <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} />
            <YAxis
              type="category"
              dataKey="merchant"
              width={100}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{data.merchant}</p>
                    <p className="font-mono">{formatCurrency(data.total)}</p>
                    <p className="text-sm text-muted-foreground">
                      {data.transaction_count} transactions
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="total"
              fill="hsl(var(--chart-2))"
              radius={[0, 4, 4, 0]}
              onClick={(data) => onMerchantClick(data.merchant)}
              className="cursor-pointer"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

#### 5. BudgetComparisonChart

```tsx
// components/trends/BudgetComparisonChart.tsx

export function BudgetComparisonChart({ data }: { data: BudgetComparison[] }) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Budget vs Actual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{item.category}</span>
                <span className={cn(
                  "font-mono",
                  item.on_track ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(item.actual)} / {formatCurrency(item.budget)}
                  {' '}
                  ({item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)})
                </span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute h-full rounded-full transition-all",
                    item.on_track ? "bg-green-500" : "bg-red-500"
                  )}
                  style={{
                    width: `${Math.min((item.actual / item.budget) * 100, 100)}%`
                  }}
                />
                {/* Budget line marker */}
                <div
                  className="absolute h-full w-0.5 bg-foreground/50"
                  style={{ left: '100%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Drill-Down Interactions

When users click on chart elements, show transaction details in a popover (consistent with existing patterns in TransactionStats):

```tsx
// Reuse existing pattern from TransactionStats
<Popover>
  <PopoverTrigger asChild>
    {/* Chart element */}
  </PopoverTrigger>
  <PopoverContent className="w-96">
    <div className="space-y-2">
      <h4 className="font-medium">{category} Transactions</h4>
      <ScrollArea className="h-[300px]">
        {transactions.map((t) => (
          <div key={t.id} className="flex justify-between py-1 border-b">
            <span className="text-sm">{t.merchant_name || t.plaid_name}</span>
            <span className="font-mono text-sm">{formatCurrency(t.amount)}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  </PopoverContent>
</Popover>
```

---

## Navigation & Routing

### Add Route

```tsx
// App.tsx
<Routes>
  <Route path="/" element={<TransactionsPage />} />
  <Route path="/yearly-budget" element={<YearlyBudgetPage />} />
  <Route path="/trends" element={<TrendsPage />} />  {/* NEW */}
</Routes>
```

### Update Navigation

Add link in TransactionsPage header (same pattern as "Yearly Budget" link):

```tsx
<Link to="/trends" className="text-sm text-muted-foreground hover:text-foreground">
  Trends →
</Link>
```

---

## Implementation Plan

### Phase 1: Backend API (~2 hours)
1. Add `trends` action to `FinancialTransactionsController`
2. Add route: `get 'financial_transactions/trends'`
3. Implement aggregation queries
4. Test with curl/Postman

### Phase 2: Frontend Foundation (~2 hours)
1. Create `pages/TrendsPage.tsx`
2. Create `lib/trendsApi.ts` with fetch function
3. Add React Query hook
4. Add route and navigation

### Phase 3: Charts (~3 hours)
1. Create `components/trends/` directory
2. Implement SummaryCards
3. Implement SpendingOverTimeChart
4. Implement CategoryBreakdownChart
5. Implement TopMerchantsChart
6. Implement BudgetComparisonChart

### Phase 4: Interactions (~1 hour)
1. Add click handlers to charts
2. Implement drill-down popovers
3. Add category filter (URL param)

### Phase 5: Polish (~1 hour)
1. Loading states
2. Empty states
3. Error handling
4. Mobile responsiveness

**Total Estimate: ~9 hours (1-2 days)**

---

## Future Enhancements

1. **Date Range Picker** — Custom date ranges, not just year
2. **Year Comparison** — Side-by-side with previous year
3. **Category Deep Dive** — Dedicated page for single category trends
4. **Export** — Download charts as PNG or data as CSV
5. **Anomaly Detection** — Highlight unusual spending patterns
6. **Recurring Detection** — Identify and visualize subscriptions

---

## Success Metrics

- **Adoption**: Users visit Trends page at least 1x/week
- **Engagement**: Average session time on Trends > 30 seconds
- **Insight Discovery**: Users click through to transaction details

---

## Open Questions

1. Should we show trends for hidden transactions? (Probably not)
2. How to handle uncategorized transactions in charts? (Group as "Uncategorized")
3. Should budget comparison be annual or monthly? (Annual, with option to toggle)
