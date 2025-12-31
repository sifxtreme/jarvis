import { useQuery } from "@tanstack/react-query";
import { getTrends, getTransactions, getBudgets, type TrendsFilters, OTHER_CATEGORY } from "../lib/api";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Download, TrendingUp, TrendingDown, Target } from "lucide-react";
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
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
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

const OTHER_COLOR = "#9ca3af"; // gray for "Other" category

const chartConfig = {
  spent: { label: "Spent", color: "#2563eb" },
};

type MonthRange = 'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'h1' | 'h2';

const MONTH_RANGES: Record<MonthRange, { label: string; months: number[] }> = {
  all: { label: "All Year", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  q1: { label: "Q1 (Jan-Mar)", months: [1, 2, 3] },
  q2: { label: "Q2 (Apr-Jun)", months: [4, 5, 6] },
  q3: { label: "Q3 (Jul-Sep)", months: [7, 8, 9] },
  q4: { label: "Q4 (Oct-Dec)", months: [10, 11, 12] },
  h1: { label: "H1 (Jan-Jun)", months: [1, 2, 3, 4, 5, 6] },
  h2: { label: "H2 (Jul-Dec)", months: [7, 8, 9, 10, 11, 12] },
};

export default function TrendsPage() {
  const currentYear = new Date().getFullYear();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<TrendsFilters>(() => ({
    year: parseInt(searchParams.get('year') || currentYear.toString()),
  }));

  // Filter states
  const [monthRange, setMonthRange] = useState<MonthRange>('all');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hiddenMerchants, setHiddenMerchants] = useState<Set<string>>(new Set());
  const [hideOther, setHideOther] = useState(false);
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [categoryCount, setCategoryCount] = useState<number>(10);
  const [merchantCategoryFilter, setMerchantCategoryFilter] = useState<string>('all');

  // Fetch current year trends
  const { data: trends, isLoading, error } = useQuery({
    queryKey: ['trends', filters],
    queryFn: () => getTrends(filters),
    retry: 2,
  });

  // Fetch previous year for YoY comparison
  const { data: prevYearTrends } = useQuery({
    queryKey: ['trends', { year: (filters.year || currentYear) - 1 }],
    queryFn: () => getTrends({ year: (filters.year || currentYear) - 1 }),
    retry: 1,
  });

  // Fetch transactions to get unique sources
  const { data: transactions } = useQuery({
    queryKey: ['transactions-for-sources', filters.year],
    queryFn: () => getTransactions({ year: filters.year, show_hidden: false, show_needs_review: false, query: '' }),
  });

  // Fetch budgets for per-category charts
  const { data: budgets } = useQuery({
    queryKey: ['budgets-for-trends', filters.year],
    queryFn: () => getBudgets({ year: filters.year, show_hidden: false, show_needs_review: false }),
  });

  // Get unique sources from transactions
  const availableSources = useMemo(() => {
    if (!transactions) return [];
    const sources = new Set<string>();
    transactions.forEach(t => {
      if (t.source) sources.add(t.source);
    });
    return Array.from(sources).sort();
  }, [transactions]);

  const handleYearChange = (year: string) => {
    const newFilters = { ...filters, year: parseInt(year) };
    setFilters(newFilters);
    setSearchParams({ year });
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleMerchant = (merchant: string) => {
    setHiddenMerchants(prev => {
      const next = new Set(prev);
      if (next.has(merchant)) {
        next.delete(merchant);
      } else {
        next.add(merchant);
      }
      return next;
    });
  };

  // Format month for display (2025-01 -> Jan)
  const formatMonth = (monthStr: string) => {
    const [, month] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(month) - 1] || month;
  };

  const getMonthNumber = (monthStr: string): number => {
    const [, month] = monthStr.split('-');
    return parseInt(month);
  };

  // Filter data by month range
  const filterByMonthRange = <T extends { month: string }>(data: T[]): T[] => {
    if (monthRange === 'all') return data;
    const allowedMonths = MONTH_RANGES[monthRange].months;
    return data.filter(d => allowedMonths.includes(getMonthNumber(d.month)));
  };

  // Calculate 3-month moving average
  const calculateMovingAverage = (data: { month: string; spent: number }[]) => {
    return data.map((item, idx) => {
      if (idx < 2) return { ...item, movingAvg: null };
      const sum = data.slice(idx - 2, idx + 1).reduce((acc, d) => acc + d.spent, 0);
      return { ...item, movingAvg: sum / 3 };
    });
  };

  // Transform monthly_by_category into recharts format
  const getCategoryChartData = () => {
    if (!trends?.monthly_by_category?.length) return [];

    const allMonths = new Set<string>();
    trends.monthly_by_category.forEach(cat => {
      cat.months.forEach(m => allMonths.add(m.month));
    });

    const months = Array.from(allMonths).sort();
    const filteredMonths = monthRange === 'all'
      ? months
      : months.filter(m => MONTH_RANGES[monthRange].months.includes(getMonthNumber(m)));

    const categoriesToShow = trends.monthly_by_category
      .filter(cat => hideOther ? cat.category !== OTHER_CATEGORY : true)
      .slice(0, categoryCount);

    return filteredMonths.map(month => {
      const dataPoint: Record<string, string | number> = { month: formatMonth(month) };
      categoriesToShow.forEach(cat => {
        const monthData = cat.months.find(m => m.month === month);
        dataPoint[cat.category] = monthData?.total || 0;
      });
      return dataPoint;
    });
  };

  // Get merchant-to-category mapping from by_merchant data (which has categories array)
  const merchantCategories = useMemo(() => {
    const map = new Map<string, Set<string>>();
    trends?.by_merchant?.forEach(m => {
      map.set(m.merchant, new Set(m.categories));
    });
    return map;
  }, [trends?.by_merchant]);

  // Get available categories for merchant filter
  const availableCategories = useMemo(() => {
    if (!trends?.by_category) return [];
    return trends.by_category.map(c => c.category).filter(c => c !== OTHER_CATEGORY);
  }, [trends?.by_category]);

  // Transform monthly_by_merchant into recharts format
  const getMerchantChartData = () => {
    if (!trends?.monthly_by_merchant?.length) return [];

    const allMonths = new Set<string>();
    trends.monthly_by_merchant.forEach(m => {
      m.months.forEach(mo => allMonths.add(mo.month));
    });

    const months = Array.from(allMonths).sort();
    const filteredMonths = monthRange === 'all'
      ? months
      : months.filter(m => MONTH_RANGES[monthRange].months.includes(getMonthNumber(m)));

    // Filter merchants by category if selected
    let merchantsToShow = trends.monthly_by_merchant;
    if (merchantCategoryFilter !== 'all') {
      merchantsToShow = merchantsToShow.filter(merch => {
        const cats = merchantCategories.get(merch.merchant);
        return cats?.has(merchantCategoryFilter);
      });
    }
    merchantsToShow = merchantsToShow.slice(0, categoryCount);

    return filteredMonths.map(month => {
      const dataPoint: Record<string, string | number> = { month: formatMonth(month) };
      merchantsToShow.forEach(merch => {
        const monthData = merch.months.find(m => m.month === month);
        dataPoint[merch.merchant] = monthData?.total || 0;
      });
      return dataPoint;
    });
  };

  // Calculate YoY change
  const getYoYChange = (current: number, previous: number): { change: number; percentage: number } | null => {
    if (!previous || previous === 0) return null;
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!trends) return;

    const rows: string[] = [];
    rows.push('Month,Spent,Transaction Count');
    trends.monthly_totals.forEach(m => {
      rows.push(`${m.month},${m.spent},${m.transaction_count}`);
    });
    rows.push('');
    rows.push('Category,Total,Transaction Count');
    trends.by_category.forEach(c => {
      rows.push(`"${c.category}",${c.total},${c.transaction_count}`);
    });
    rows.push('');
    rows.push('Merchant,Total,Transaction Count');
    trends.by_merchant.forEach(m => {
      rows.push(`"${m.merchant}",${m.total},${m.transaction_count}`);
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spending-trends-${filters.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Custom legend with click handler
  const renderClickableLegend = (props: any, hiddenSet: Set<string>, toggleFn: (name: string) => void) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {payload?.map((entry: any, index: number) => {
          const isHidden = hiddenSet.has(entry.value);
          const isOther = entry.value === OTHER_CATEGORY;
          return (
            <button
              key={`legend-${index}`}
              onClick={() => toggleFn(entry.value)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all",
                isHidden ? "opacity-40 line-through" : "opacity-100",
                isOther ? "italic" : ""
              )}
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: isOther ? OTHER_COLOR : entry.color }}
              />
              <span>{entry.value}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Custom tooltip sorted by value
  const renderSortedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const sortedPayload = [...payload].sort((a, b) => (b.value as number) - (a.value as number));
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-medium mb-2">{label}</p>
        {sortedPayload.map((entry: any, idx: number) => (
          <div key={idx} className="flex justify-between gap-4 text-sm">
            <span style={{ color: entry.color }} className="truncate max-w-[150px]">
              {entry.name}
            </span>
            <span className="font-mono">{formatCurrency(entry.value as number)}</span>
          </div>
        ))}
      </div>
    );
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
  const allCategories = (trends?.monthly_by_category || [])
    .filter(cat => hideOther ? cat.category !== OTHER_CATEGORY : true)
    .slice(0, categoryCount);

  // Filter merchants for chart - apply category filter
  let filteredMerchants = trends?.monthly_by_merchant || [];
  if (merchantCategoryFilter !== 'all') {
    filteredMerchants = filteredMerchants.filter(merch => {
      const cats = merchantCategories.get(merch.merchant);
      return cats?.has(merchantCategoryFilter);
    });
  }
  const allMerchants = filteredMerchants.slice(0, categoryCount);

  // Filter and add moving average to monthly data
  const monthlyData = filterByMonthRange(trends?.monthly_totals || []);
  const monthlyDataWithMA = calculateMovingAverage(monthlyData);
  const avgSpending = monthlyData.length > 0
    ? monthlyData.reduce((sum, m) => sum + m.spent, 0) / monthlyData.length
    : 0;

  // YoY calculations
  const yoySpent = getYoYChange(
    trends?.period?.total_spent || 0,
    prevYearTrends?.period?.total_spent || 0
  );
  const yoyIncome = getYoYChange(
    trends?.period?.total_income || 0,
    prevYearTrends?.period?.total_income || 0
  );
  const yoySavings = getYoYChange(
    trends?.period?.net_savings || 0,
    prevYearTrends?.period?.net_savings || 0
  );

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Spending Trends</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Range Filter */}
          <Select value={monthRange} onValueChange={(v) => setMonthRange(v as MonthRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month Range" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MONTH_RANGES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Filter */}
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

          {/* Source Filter */}
          {availableSources.length > 0 && (
            <Select
              value={selectedSources.size === 0 ? "all" : Array.from(selectedSources).join(",")}
              onValueChange={(v) => {
                if (v === "all") {
                  setSelectedSources(new Set());
                }
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Source">
                  {selectedSources.size === 0 ? "All Sources" : `${selectedSources.size} selected`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {availableSources.map(source => (
                  <div
                    key={source}
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSource(source);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.has(source)}
                      onChange={() => toggleSource(source)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{source}</span>
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Category Count */}
          <Select value={categoryCount.toString()} onValueChange={(v) => setCategoryCount(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Items" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="15">Top 15</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="50">All</SelectItem>
            </SelectContent>
          </Select>

          {/* Hide Other Toggle */}
          <Button
            variant={hideOther ? "default" : "outline"}
            size="sm"
            onClick={() => setHideOther(!hideOther)}
            className="text-xs"
          >
            {hideOther ? "Show Other" : "Hide Other"}
          </Button>

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards with YoY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(trends?.period?.total_spent || 0)}</div>
            {yoySpent && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                yoySpent.change > 0 ? "text-red-500" : "text-green-500"
              )}>
                {yoySpent.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{yoySpent.percentage > 0 ? '+' : ''}{yoySpent.percentage.toFixed(1)}% YoY</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(trends?.period?.total_income || 0)}</div>
            {yoyIncome && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                yoyIncome.change > 0 ? "text-green-500" : "text-red-500"
              )}>
                {yoyIncome.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{yoyIncome.percentage > 0 ? '+' : ''}{yoyIncome.percentage.toFixed(1)}% YoY</span>
              </div>
            )}
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
            {yoySavings && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                yoySavings.change > 0 ? "text-green-500" : "text-red-500"
              )}>
                {yoySavings.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{yoySavings.percentage > 0 ? '+' : ''}{yoySavings.percentage.toFixed(1)}% YoY</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{trends?.period?.total_transactions || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Avg: {formatCurrency(avgSpending)}/mo
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Spending Trend */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Monthly Spending</CardTitle>
          <Button
            variant={showMovingAvg ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMovingAvg(!showMovingAvg)}
            className="text-xs"
          >
            3-Mo Avg
          </Button>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={monthlyDataWithMA}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                      {data.movingAvg && (
                        <p className="text-sm text-orange-500">3-mo avg: {formatCurrency(data.movingAvg)}</p>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine
                y={avgSpending}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                label={{ value: `Avg: ${formatCurrency(avgSpending)}`, position: 'right', fontSize: 10 }}
              />
              <Line
                type="linear"
                dataKey="spent"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {showMovingAvg && (
                <Line
                  type="linear"
                  dataKey="movingAvg"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
              )}
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
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip content={renderSortedTooltip} />
              <Legend content={(props) => renderClickableLegend(props, hiddenCategories, toggleCategory)} />
              {allCategories.map((cat, idx) => (
                <Line
                  key={cat.category}
                  type="linear"
                  dataKey={cat.category}
                  stroke={cat.category === OTHER_CATEGORY ? OTHER_COLOR : COLORS[idx % COLORS.length]}
                  strokeWidth={hiddenCategories.has(cat.category) ? 0 : 2}
                  dot={{ r: 3 }}
                  strokeDasharray={cat.category === OTHER_CATEGORY ? "3 3" : undefined}
                  opacity={hiddenCategories.has(cat.category) ? 0 : 1}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Merchant Trends */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Spending by Merchant (Month over Month)</CardTitle>
          <Select value={merchantCategoryFilter} onValueChange={setMerchantCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {availableCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <LineChart data={merchantChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip content={renderSortedTooltip} />
              <Legend content={(props) => renderClickableLegend(props, hiddenMerchants, toggleMerchant)} />
              {allMerchants.map((merch, idx) => (
                <Line
                  key={merch.merchant}
                  type="linear"
                  dataKey={merch.merchant}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={hiddenMerchants.has(merch.merchant) ? 0 : 2}
                  dot={{ r: 3 }}
                  opacity={hiddenMerchants.has(merch.merchant) ? 0 : 1}
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
                  data={(trends?.by_category || [])
                    .filter(c => hideOther ? c.category !== OTHER_CATEGORY : true)
                    .slice(0, Math.min(categoryCount, 10))}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {(trends?.by_category || [])
                    .filter(c => hideOther ? c.category !== OTHER_CATEGORY : true)
                    .slice(0, Math.min(categoryCount, 10))
                    .map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.category === OTHER_CATEGORY ? OTHER_COLOR : COLORS[idx % COLORS.length]}
                      />
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
              <BarChart data={trends?.by_merchant?.slice(0, Math.min(categoryCount, 15)) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
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

      {/* Per-Budget Category Charts */}
      {budgets && budgets.filter(b => b.expense_type === 'expense').length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>Budget Tracking by Category</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets
                .filter(b => b.expense_type === 'expense' && b.amount > 0)
                .map(budget => {
                  const categoryData = trends?.monthly_by_category?.find(c => c.category === budget.name);
                  const monthlyBudget = budget.amount;

                  // Get monthly data for this category
                  const chartData = categoryData?.months.map(m => {
                    const variance = monthlyBudget - m.total;
                    const variancePercent = monthlyBudget > 0 ? ((m.total - monthlyBudget) / monthlyBudget) * 100 : 0;
                    return {
                      month: formatMonth(m.month),
                      actual: m.total,
                      budget: monthlyBudget,
                      variance,
                      variancePercent,
                      overBudget: m.total > monthlyBudget
                    };
                  }) || [];

                  // Calculate YTD totals
                  const ytdActual = chartData.reduce((sum, d) => sum + d.actual, 0);
                  const ytdBudget = monthlyBudget * chartData.length;
                  const ytdVariance = ytdBudget - ytdActual;
                  const ytdVariancePercent = ytdBudget > 0 ? ((ytdActual - ytdBudget) / ytdBudget) * 100 : 0;
                  const isOverBudget = ytdActual > ytdBudget;

                  return (
                    <Card key={budget.id} className={cn(
                      "border-l-4",
                      isOverBudget ? "border-l-red-500" : "border-l-green-500"
                    )}>
                      <CardHeader className="py-2 px-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm font-medium">{budget.name}</CardTitle>
                          <span className={cn(
                            "text-xs font-mono",
                            isOverBudget ? "text-red-600" : "text-green-600"
                          )}>
                            {ytdVariancePercent > 0 ? '+' : ''}{ytdVariancePercent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(ytdActual)} / {formatCurrency(ytdBudget)} YTD
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 px-3">
                        <ChartContainer config={chartConfig} className="h-[120px] w-full">
                          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border rounded-lg p-2 shadow-lg text-xs">
                                    <p className="font-medium">{data.month}</p>
                                    <p className="font-mono">Actual: {formatCurrency(data.actual)}</p>
                                    <p className="font-mono text-muted-foreground">Budget: {formatCurrency(data.budget)}</p>
                                    <p className={cn(
                                      "font-mono",
                                      data.overBudget ? "text-red-600" : "text-green-600"
                                    )}>
                                      {data.variancePercent > 0 ? '+' : ''}{data.variancePercent.toFixed(0)}% ({data.variance >= 0 ? '+' : ''}{formatCurrency(data.variance)})
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <ReferenceLine y={monthlyBudget} stroke="#9ca3af" strokeDasharray="3 3" />
                            <Bar
                              dataKey="actual"
                              radius={[2, 2, 0, 0]}
                            >
                              {chartData.map((entry, idx) => (
                                <Cell
                                  key={idx}
                                  fill={entry.overBudget ? "#ef4444" : "#22c55e"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Comparison Summary */}
      {trends?.budget_comparison && trends.budget_comparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual (Annual Summary)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trends.budget_comparison.filter(b => b.budget > 0).map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={item.category === OTHER_CATEGORY ? 'italic text-muted-foreground' : ''}>
                      {item.category}
                    </span>
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
