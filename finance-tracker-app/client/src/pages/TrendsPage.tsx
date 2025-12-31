import { useQuery } from "@tanstack/react-query";
import { getTrends, type TrendsFilters } from "../lib/api";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#c026d3", // fuchsia
  "#ca8a04", // yellow
  "#64748b", // slate
  "#be123c", // rose
];

const chartConfig = {
  spent: { label: "Spent", color: "#2563eb" },
};

export default function TrendsPage() {
  const currentYear = new Date().getFullYear();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<TrendsFilters>(() => ({
    year: parseInt(searchParams.get('year') || currentYear.toString()),
  }));

  const { data: trends, isLoading, error } = useQuery({
    queryKey: ['trends', filters],
    queryFn: () => getTrends(filters),
    retry: 2,
  });

  const handleYearChange = (year: string) => {
    const newFilters = { ...filters, year: parseInt(year) };
    setFilters(newFilters);
    setSearchParams({ year });
  };

  // Format month for display (2025-01 -> Jan)
  const formatMonth = (monthStr: string) => {
    const [, month] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(month) - 1] || month;
  };

  // Transform monthly_by_category into recharts format
  const getCategoryChartData = () => {
    if (!trends?.monthly_by_category?.length) return [];

    // Get all unique months
    const allMonths = new Set<string>();
    trends.monthly_by_category.forEach(cat => {
      cat.months.forEach(m => allMonths.add(m.month));
    });

    // Create data points for each month
    const months = Array.from(allMonths).sort();
    return months.map(month => {
      const dataPoint: Record<string, string | number> = { month: formatMonth(month) };
      trends.monthly_by_category.slice(0, 6).forEach(cat => {
        const monthData = cat.months.find(m => m.month === month);
        dataPoint[cat.category] = monthData?.total || 0;
      });
      return dataPoint;
    });
  };

  // Transform monthly_by_merchant into recharts format
  const getMerchantChartData = () => {
    if (!trends?.monthly_by_merchant?.length) return [];

    const allMonths = new Set<string>();
    trends.monthly_by_merchant.forEach(m => {
      m.months.forEach(mo => allMonths.add(mo.month));
    });

    const months = Array.from(allMonths).sort();
    return months.map(month => {
      const dataPoint: Record<string, string | number> = { month: formatMonth(month) };
      trends.monthly_by_merchant.slice(0, 6).forEach(merch => {
        const monthData = merch.months.find(m => m.month === month);
        dataPoint[merch.merchant] = monthData?.total || 0;
      });
      return dataPoint;
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-500">Error loading trends: {error.message}</div>
      </div>
    );
  }

  const categoryChartData = getCategoryChartData();
  const merchantChartData = getMerchantChartData();
  const topCategories = trends?.monthly_by_category?.slice(0, 6) || [];
  const topMerchants = trends?.monthly_by_merchant?.slice(0, 6) || [];

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Spending Trends</h1>
        <Select value={filters.year?.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {[2026, 2025, 2024, 2023, 2022].map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(trends?.period?.total_spent || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(trends?.period?.total_income || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold font-mono",
              (trends?.period?.net_savings || 0) >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(trends?.period?.net_savings || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{trends?.period?.total_transactions || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Spending Trend */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={trends?.monthly_totals || []}>
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{data.month}</p>
                      <p className="font-mono">{formatCurrency(data.spent)}</p>
                      <p className="text-sm text-muted-foreground">{data.transaction_count} transactions</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="spent"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Category Trends */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Spending by Category (Month over Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <LineChart data={categoryChartData}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
                      <p className="font-medium mb-2">{label}</p>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex justify-between gap-4 text-sm">
                          <span style={{ color: entry.color }}>{entry.name}</span>
                          <span className="font-mono">{formatCurrency(entry.value as number)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              {topCategories.map((cat, idx) => (
                <Line
                  key={cat.category}
                  type="monotone"
                  dataKey={cat.category}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Merchant Trends */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Spending by Merchant (Month over Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <LineChart data={merchantChartData}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
                      <p className="font-medium mb-2">{label}</p>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex justify-between gap-4 text-sm">
                          <span style={{ color: entry.color }} className="truncate max-w-[150px]">{entry.name}</span>
                          <span className="font-mono">{formatCurrency(entry.value as number)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              {topMerchants.map((merch, idx) => (
                <Line
                  key={merch.merchant}
                  type="monotone"
                  dataKey={merch.merchant}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Category Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={trends?.by_category?.slice(0, 8) || []}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {(trends?.by_category?.slice(0, 8) || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{data.category}</p>
                        <p className="font-mono">{formatCurrency(data.total)}</p>
                        <p className="text-sm text-muted-foreground">{data.transaction_count} transactions</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Merchants Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={trends?.by_merchant?.slice(0, 8) || []} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="merchant"
                  width={120}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{data.merchant}</p>
                        <p className="font-mono">{formatCurrency(data.total)}</p>
                        <p className="text-sm text-muted-foreground">{data.transaction_count} transactions</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Budget Comparison */}
      {trends?.budget_comparison && trends.budget_comparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual (Annual)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trends.budget_comparison.filter(b => b.budget > 0).map((item) => (
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
