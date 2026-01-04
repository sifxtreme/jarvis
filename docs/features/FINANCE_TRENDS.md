# Feature: Finance Trends & Insights
Date: 2026-01-02

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
| `category` | string | null | Filter to specific category |

**Notes:**
- Excludes hidden transactions.
- Income is identified by category containing "income".
- Amortized transactions are split across `amortized_months` within the target year.

**Response:**
```json
{
  "period": {
    "year": 2025,
    "total_transactions": 1247,
    "total_spent": 45678.9,
    "total_income": 52000.0,
    "net_savings": 6321.1
  },
  "monthly_totals": [
    { "month": "2025-01", "spent": 4523.45, "transaction_count": 87 }
  ],
  "by_category": [
    { "category": "Groceries", "total": 8234.56, "transaction_count": 145, "budget": 96000.0, "variance": 87765.44, "monthly_avg": 686.21 }
  ],
  "by_merchant": [
    { "merchant": "Amazon", "total": 2567.89, "transaction_count": 42, "categories": ["Shopping"], "last_transaction": "2025-01-15" }
  ],
  "budget_comparison": [
    { "category": "Groceries", "budget": 96000.0, "actual": 8234.56, "variance": 87765.44, "variance_percent": 91.4, "on_track": true }
  ],
  "monthly_by_category": [
    { "category": "Groceries", "months": [{ "month": "2025-01", "total": 512.12 }] }
  ],
  "monthly_by_merchant": [
    { "merchant": "Amazon", "months": [{ "month": "2025-01", "total": 120.45, "transaction_count": 3 }] }
  ]
}
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
