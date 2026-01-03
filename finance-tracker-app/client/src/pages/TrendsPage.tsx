import { useQuery } from "@tanstack/react-query";
import {
  getTrends,
  getTransactions,
  getBudgets,
  getMerchantTrends,
  getMerchantSuggestions,
  getMerchantTransactions,
  type TrendsFilters,
  OTHER_CATEGORY,
  type Transaction,
} from "../lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartContainer } from "@/components/ui/chart";
import { formatCurrency, cn, YEARS, getMonthKey } from "@/lib/utils";
import { Copy as CopyIcon, Download, TrendingUp, TrendingDown, Target, X, Search } from "lucide-react";
import { CategoryDrilldownModal } from "@/components/CategoryDrilldownModal";
import { StateCard } from "@/components/StateCard";
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
} from "recharts";
import type { TooltipProps as RechartsTooltipProps } from "recharts";

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

type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { monthKey?: string };
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
  const currentMonth = new Date().getMonth() + 1;
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
  const [pinnedCategoryDot, setPinnedCategoryDot] = useState<{ dataKey: string; index: number } | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [merchantQuery, setMerchantQuery] = useState("");
  const [merchantExact, setMerchantExact] = useState(false);
  const [merchantStartMonth, setMerchantStartMonth] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  });
  const [merchantEndMonth, setMerchantEndMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [merchantSuggestionsOpen, setMerchantSuggestionsOpen] = useState(false);
  const [highlightedMerchantSuggestion, setHighlightedMerchantSuggestion] = useState(-1);
  const merchantSearchRef = useRef<HTMLDivElement | null>(null);
  const merchantInputRef = useRef<HTMLInputElement | null>(null);
  const [merchantTransactionsOpen, setMerchantTransactionsOpen] = useState(false);

  // Hover state for precise dot highlighting
  const [hoveredCategoryDot, setHoveredCategoryDot] = useState<{ dataKey: string; index: number } | null>(null);
  const [hoveredMerchantDot, setHoveredMerchantDot] = useState<{ dataKey: string; index: number } | null>(null);

  // Category drill-down modal state
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownTransactions, setDrilldownTransactions] = useState<Transaction[]>([]);
  const [drilldownSubtitle, setDrilldownSubtitle] = useState<string | null>(null);

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

  const { data: merchantSuggestions } = useQuery({
    queryKey: ['merchant-suggestions', merchantQuery, merchantExact, merchantStartMonth, merchantEndMonth],
    queryFn: () =>
      getMerchantSuggestions({
        query: merchantQuery.trim(),
        exact: merchantExact,
        start_month: merchantStartMonth,
        end_month: merchantEndMonth,
        limit: 8,
      }),
    enabled: merchantQuery.trim().length > 1,
    staleTime: 30_000,
    retry: 1,
  });

  const {
    data: merchantTransactions = [],
    isLoading: merchantTransactionsLoading,
  } = useQuery({
    queryKey: [
      'merchant-transactions',
      merchantQuery,
      merchantExact,
      merchantStartMonth,
      merchantEndMonth,
      merchantTransactionsOpen,
    ],
    queryFn: () =>
      getMerchantTransactions({
        query: merchantQuery.trim(),
        exact: merchantExact,
        start_month: merchantStartMonth,
        end_month: merchantEndMonth,
      }),
    enabled: merchantTransactionsOpen && merchantQuery.trim().length > 0,
    retry: 1,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!merchantSearchRef.current) return;
      if (!merchantSearchRef.current.contains(event.target as Node)) {
        setMerchantSuggestionsOpen(false);
        setHighlightedMerchantSuggestion(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (merchantQuery.trim().length > 1 && (merchantSuggestions?.suggestions?.length || 0) > 0) {
      setMerchantSuggestionsOpen(true);
      return;
    }
    setMerchantSuggestionsOpen(false);
    setHighlightedMerchantSuggestion(-1);
  }, [merchantQuery, merchantSuggestions]);

  const { data: merchantTrends, isLoading: merchantTrendsLoading, error: merchantTrendsError } = useQuery({
    queryKey: ['merchant-trends', merchantQuery, merchantExact, merchantStartMonth, merchantEndMonth],
    queryFn: () =>
      getMerchantTrends({
        query: merchantQuery.trim(),
        exact: merchantExact,
        start_month: merchantStartMonth,
        end_month: merchantEndMonth,
      }),
    enabled: merchantQuery.trim().length > 0,
    retry: 1,
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

  // Get budgeted categories for mapping non-budgeted to "Other"
  const budgetedCategoryNames = useMemo(() => {
    if (!budgets) return new Set<string>();
    return new Set(budgets.filter(b => b.amount > 0).map(b => b.name));
  }, [budgets]);

  // Open category drill-down modal
  const openCategoryDrilldown = (category: string, monthKey?: string) => {
    if (!transactions) return;

    // Filter transactions for this category (expenses only)
    let categoryTransactions = transactions.filter(t => {
      // Skip income
      if (t.category?.toLowerCase()?.includes('income')) return false;

      if (category === OTHER_CATEGORY) {
        // "Other" category includes transactions with non-budgeted categories
        return !budgetedCategoryNames.has(t.category || '');
      }

      return t.category === category;
    });

    if (monthKey) {
      categoryTransactions = categoryTransactions.filter((transaction) => {
        const transactionMonth = getMonthKey(transaction.transacted_at);
        const amortizedMonths = transaction.amortized_months || [];
        return transactionMonth === monthKey || amortizedMonths.includes(monthKey);
      });
      setDrilldownSubtitle(formatMonthWithYear(monthKey));
    } else {
      setDrilldownSubtitle(null);
    }

    setDrilldownCategory(category);
    setDrilldownTransactions(categoryTransactions);
  };

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

  const formatMonthWithYear = (monthStr: string) => {
    const [year] = monthStr.split("-");
    const monthLabel = formatMonth(monthStr);
    return `${monthLabel} '${year.slice(-2)}`;
  };

  const formatAxisCurrency = (value: number, max: number) => {
    if (max < 1000) {
      return `$${value.toFixed(1)}`;
    }
    if (max < 1_000_000) {
      const short = (value / 1000).toFixed(1);
      return `$${short}k`;
    }
    const short = (value / 1_000_000).toFixed(1);
    return `$${short}M`;
  };

  const getMonthRange = (startMonth: string, endMonth: string): string[] => {
    const [startYear, startMon] = startMonth.split("-").map(Number);
    const [endYear, endMon] = endMonth.split("-").map(Number);
    const months: string[] = [];
    let cursor = new Date(startYear, startMon - 1, 1);
    const end = new Date(endYear, endMon - 1, 1);
    while (cursor <= end) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return months;
  };

  const getMonthNumber = (monthStr: string): number => {
    const [, month] = monthStr.split('-');
    return parseInt(month);
  };

  // Filter data by month range
  const filterByMonthRange = <T extends { month: string }>(data: T[]): T[] => {
    const scoped = filters.year === currentYear
      ? data.filter(d => getMonthNumber(d.month) <= currentMonth)
      : data;
    if (monthRange === 'all') return scoped;
    const allowedMonths = MONTH_RANGES[monthRange].months;
    return scoped.filter(d => allowedMonths.includes(getMonthNumber(d.month)));
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
    const scopedMonths = filters.year === currentYear
      ? months.filter(m => getMonthNumber(m) <= currentMonth)
      : months;
    const filteredMonths = monthRange === 'all'
      ? scopedMonths
      : scopedMonths.filter(m => MONTH_RANGES[monthRange].months.includes(getMonthNumber(m)));

    const categoriesToShow = trends.monthly_by_category
      .filter(cat => hideOther ? cat.category !== OTHER_CATEGORY : true)
      .slice(0, categoryCount);

    const data = filteredMonths.map(month => {
      const dataPoint: Record<string, string | number | null> = { month: formatMonth(month), monthKey: month };
      let total = 0;
      categoriesToShow.forEach(cat => {
        const monthData = cat.months.find(m => m.month === month);
        const value = monthData?.total || 0;
        dataPoint[cat.category] = value;
        if (!hiddenCategories.has(cat.category)) {
          total += value;
        }
      });
      dataPoint._total = total;
      return dataPoint;
    });

    return data;
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
    const scopedMonths = filters.year === currentYear
      ? months.filter(m => getMonthNumber(m) <= currentMonth)
      : months;
    const filteredMonths = monthRange === 'all'
      ? scopedMonths
      : scopedMonths.filter(m => MONTH_RANGES[monthRange].months.includes(getMonthNumber(m)));

    // Filter merchants by category if selected
    let merchantsToShow = trends.monthly_by_merchant;
    if (merchantCategoryFilter !== 'all') {
      merchantsToShow = merchantsToShow.filter(merch => {
        const cats = merchantCategories.get(merch.merchant);
        return cats?.has(merchantCategoryFilter);
      });
    }
    merchantsToShow = merchantsToShow.slice(0, categoryCount);

    const data = filteredMonths.map(month => {
      const dataPoint: Record<string, string | number | null> = { month: formatMonth(month) };
      let total = 0;
      merchantsToShow.forEach(merch => {
        const monthData = merch.months.find(m => m.month === month);
        const value = monthData?.total || 0;
        dataPoint[merch.merchant] = value;
        if (!hiddenMerchants.has(merch.merchant)) {
          total += value;
        }
      });
      dataPoint._total = total;
      return dataPoint;
    });

    return data;
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
  const renderClickableLegend = (props: unknown, hiddenSet: Set<string>, toggleFn: (name: string) => void) => {
    const { payload } = (props as { payload?: Array<{ value: string | number; color?: string }> });
    return (
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {payload?.map((entry, index) => {
          const value = String(entry.value);
          const isHidden = hiddenSet.has(value);
          const isOther = value === OTHER_CATEGORY;
          return (
            <button
              key={`legend-${index}`}
              onClick={(event) => {
                if (event.shiftKey) {
                  setPinnedCategoryDot((current) => {
                    if (current?.dataKey === value) return null;
                    return { dataKey: value, index: 0 };
                  });
                  return;
                }
                toggleFn(value);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all",
                isHidden ? "opacity-40 line-through" : "opacity-100",
                isOther ? "italic" : ""
              )}
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: isOther ? OTHER_COLOR : entry.color || "#94a3b8" }}
              />
              <span>{value}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Custom tooltip sorted by value
  // Custom tooltip that only shows when hovering a specific dot
  const renderCategoryDotTooltip = ({ payload, label }: RechartsTooltipProps<number, string>) => {
    const activeDot = hoveredCategoryDot || pinnedCategoryDot;
    if (!activeDot || !payload?.length) return null;
    const hoveredEntry = payload.find((p) => String(p.dataKey) === activeDot.dataKey);
    if (!hoveredEntry) return null;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-1">{label}</p>
        <div className="flex justify-between gap-4 text-sm">
          <span style={{ color: hoveredEntry.color }}>{String(hoveredEntry.name || "")}</span>
          <span className="font-mono">{formatCurrency(Number(hoveredEntry.value || 0))}</span>
        </div>
      </div>
    );
  };

  const renderMerchantDotTooltip = ({ payload, label }: RechartsTooltipProps<number, string>) => {
    if (!hoveredMerchantDot || !payload?.length) return null;
    const hoveredEntry = payload.find((p) => String(p.dataKey) === hoveredMerchantDot.dataKey);
    if (!hoveredEntry) return null;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-1">{label}</p>
        <div className="flex justify-between gap-4 text-sm">
          <span style={{ color: hoveredEntry.color }}>{String(hoveredEntry.name || "")}</span>
          <span className="font-mono">{formatCurrency(Number(hoveredEntry.value || 0))}</span>
        </div>
      </div>
    );
  };

  // Custom dot component for category chart
  const renderCategoryDot = (props: DotProps, dataKey: string, color: string): React.ReactElement<SVGElement> => {
    const { cx, cy, index, payload } = props;
    if (cx === undefined || cy === undefined) return <circle r={0} />;
    const safeIndex = typeof index === "number" ? index : 0;
    const isHovered = hoveredCategoryDot?.dataKey === dataKey && hoveredCategoryDot?.index === safeIndex;
    const isPinned = pinnedCategoryDot?.dataKey === dataKey && pinnedCategoryDot?.index === safeIndex;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isHovered || isPinned ? 8 : 3}
        fill={isHovered || isPinned ? 'white' : color}
        stroke={color}
        strokeWidth={isHovered || isPinned ? 2 : 0}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoveredCategoryDot({ dataKey, index: safeIndex })}
        onMouseLeave={() => setHoveredCategoryDot(null)}
        onClick={(event) => {
          if (event.shiftKey) {
            setPinnedCategoryDot((current) => {
              if (current?.dataKey === dataKey && current.index === safeIndex) return null;
              return { dataKey, index: safeIndex };
            });
            return;
          }
          const monthKey = payload?.monthKey as string | undefined;
          openCategoryDrilldown(dataKey, monthKey);
        }}
      />
    );
  };

  // Custom dot component for merchant chart
  const renderMerchantDot = (props: DotProps, dataKey: string, color: string): React.ReactElement<SVGElement> => {
    const { cx, cy, index } = props;
    if (cx === undefined || cy === undefined) return <circle r={0} />;
    const safeIndex = typeof index === "number" ? index : 0;
    const isHovered = hoveredMerchantDot?.dataKey === dataKey && hoveredMerchantDot?.index === safeIndex;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isHovered ? 8 : 3}
        fill={isHovered ? 'white' : color}
        stroke={color}
        strokeWidth={isHovered ? 2 : 0}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoveredMerchantDot({ dataKey, index: safeIndex })}
        onMouseLeave={() => setHoveredMerchantDot(null)}
      />
    );
  };

  const merchantTrendSeries = useMemo(() => {
    if (!merchantTrends) return [];
    const months = getMonthRange(merchantTrends.start_month, merchantTrends.end_month);
    const totals = new Map(merchantTrends.months.map(item => [item.month, item.total]));
    return months.map(month => ({ month, total: totals.get(month) || 0 }));
  }, [merchantTrends]);

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-4 md:p-6">
        <StateCard title="Loading trends" description="Crunching your latest spending data." variant="loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-auto p-4 md:p-6">
        <StateCard title="Error loading trends" description={error.message} variant="error" />
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
  const merchantVisibleMax = merchantChartData.length
    ? Math.max(...merchantChartData.map(d => {
        let max = 0;
        allMerchants.forEach(merch => {
          if (!hiddenMerchants.has(merch.merchant)) {
            const val = (d as Record<string, number | string | null>)[merch.merchant] as number || 0;
            if (val > max) max = val;
          }
        });
        return max;
      }))
    : 0;
  const merchantTrendMax = merchantTrendSeries.length > 0
    ? Math.max(...merchantTrendSeries.map(d => d.total))
    : 0;

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

  const activeFilters = [
    monthRange !== 'all' && {
      label: MONTH_RANGES[monthRange].label,
      onRemove: () => setMonthRange('all'),
    },
    selectedSources.size > 0 && {
      label: `${selectedSources.size} source${selectedSources.size > 1 ? 's' : ''}`,
      onRemove: () => setSelectedSources(new Set()),
    },
    hideOther && {
      label: "Hide Other",
      onRemove: () => setHideOther(false),
    },
    merchantCategoryFilter !== 'all' && {
      label: `Merchants: ${merchantCategoryFilter}`,
      onRemove: () => setMerchantCategoryFilter('all'),
    },
    hiddenCategories.size > 0 && {
      label: `${hiddenCategories.size} hidden category${hiddenCategories.size > 1 ? 's' : ''}`,
      onRemove: () => setHiddenCategories(new Set()),
    },
    hiddenMerchants.size > 0 && {
      label: `${hiddenMerchants.size} hidden merchant${hiddenMerchants.size > 1 ? 's' : ''}`,
      onRemove: () => setHiddenMerchants(new Set()),
    },
    categoryCount !== 10 && {
      label: `Top ${categoryCount}`,
      onRemove: () => setCategoryCount(10),
    },
  ].filter(Boolean) as { label: string; onRemove: () => void }[];

  const copySummary = async () => {
    if (!trends) return;
    const lines = [
      `Spending Trends (${filters.year})`,
      `Total Spent: ${formatCurrency(trends.period.total_spent)}`,
      `Total Income: ${formatCurrency(trends.period.total_income)}`,
      `Net Savings: ${formatCurrency(trends.period.net_savings)}`,
      `Transactions: ${trends.period.total_transactions}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (error) {
      console.error("Failed to copy summary", error);
    }
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Spending Trends</h1>
        <div className="flex flex-wrap items-end gap-2">
          {/* Month Range Filter */}
          <Select value={monthRange} onValueChange={(v) => setMonthRange(v as MonthRange)}>
            <SelectTrigger className="h-9 w-[140px] text-sm">
              <SelectValue placeholder="Month Range" />
            </SelectTrigger>
            <SelectContent className="text-sm">
              {Object.entries(MONTH_RANGES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Filter */}
          <Select value={filters.year?.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="h-9 w-[100px] text-sm">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="text-sm">
              {YEARS.map(year => (
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
              <SelectTrigger className="h-9 w-[120px] text-sm">
                <SelectValue placeholder="Source">
                  {selectedSources.size === 0 ? "All Sources" : `${selectedSources.size} selected`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="text-sm">
                <SelectItem value="all">All Sources</SelectItem>
                {availableSources.map(source => (
                  <div
                    key={source}
                    className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSource(source);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.has(source)}
                      onChange={() => toggleSource(source)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm">{source}</span>
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Category Count */}
          <Select value={categoryCount.toString()} onValueChange={(v) => setCategoryCount(parseInt(v))}>
            <SelectTrigger className="h-9 w-[100px] text-sm">
              <SelectValue placeholder="Items" />
            </SelectTrigger>
            <SelectContent className="text-sm">
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
            className="h-9 px-3 text-sm"
          >
            {hideOther ? "Show Other" : "Hide Other"}
          </Button>

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={copySummary} className="h-9 px-3 text-sm">
            <CopyIcon className="h-4 w-4 mr-1" />
            {copyStatus === "copied" ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="h-9 px-3 text-sm">
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {activeFilters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={filter.onRemove}
            >
              {filter.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

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
          <CardTitle className="text-base font-semibold">Monthly Spending</CardTitle>
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
                cursor={false}
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
                activeDot={{ r: 8, stroke: '#2563eb', strokeWidth: 2, fill: 'white' }}
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
          <CardTitle className="text-base font-semibold">Spending by Category (Month over Month)</CardTitle>
          <div className="text-xs text-muted-foreground">Shift-click a legend item or dot to pin a category.</div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <LineChart data={categoryChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
                domain={[0, () => {
                  // Calculate max from visible categories only
                  const visibleMax = Math.max(...categoryChartData.map(d => {
                    let max = 0;
                    allCategories.forEach(cat => {
                      if (!hiddenCategories.has(cat.category)) {
                        const val = (d as Record<string, number | string | null>)[cat.category] as number || 0;
                        if (val > max) max = val;
                      }
                    });
                    return max;
                  }));
                  return Math.ceil(visibleMax * 1.1) || 1000; // 10% padding, fallback to 1000
                }]}
              />
              <Tooltip cursor={false} content={renderCategoryDotTooltip} />
              <Legend content={(props) => renderClickableLegend(props, hiddenCategories, toggleCategory)} />
              {allCategories.map((cat, idx) => {
                const color = cat.category === OTHER_CATEGORY ? OTHER_COLOR : COLORS[idx % COLORS.length];
                const isPinned = pinnedCategoryDot?.dataKey === cat.category;
                const dimmed = pinnedCategoryDot && !isPinned;
                return (
                  <Line
                    key={cat.category}
                    type="linear"
                    dataKey={cat.category}
                    stroke={color}
                    strokeWidth={hiddenCategories.has(cat.category) ? 0 : isPinned ? 3 : 2}
                    dot={(props) => renderCategoryDot(props, cat.category, color)}
                    activeDot={false}
                    strokeDasharray={cat.category === OTHER_CATEGORY ? "3 3" : undefined}
                    opacity={hiddenCategories.has(cat.category) ? 0 : dimmed ? 0.2 : 1}
                  />
                );
              })}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Merchant Search */}
      <Card className="mb-8">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base font-semibold">Merchant Search</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {merchantTrends?.merchant && (
              <div>
                {merchantTrends.merchant} · {formatCurrency(merchantTrends.total_spent)}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setMerchantTransactionsOpen(true)}
              disabled={merchantQuery.trim().length === 0 || merchantTransactionsLoading}
            >
              {merchantTransactionsLoading ? "Loading..." : "View transactions"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(240px,1.5fr)_auto_auto] md:items-center">
              <div>
                <div className="relative" ref={merchantSearchRef}>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search merchants..."
                    value={merchantQuery}
                    onChange={(event) => {
                      setMerchantQuery(event.target.value);
                      setHighlightedMerchantSuggestion(-1);
                    }}
                    onFocus={() => {
                      if (merchantSuggestions?.suggestions?.length) setMerchantSuggestionsOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (!merchantSuggestionsOpen || !merchantSuggestions?.suggestions?.length) return;
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setHighlightedMerchantSuggestion((current) =>
                          Math.min(current + 1, merchantSuggestions.suggestions.length - 1)
                        );
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setHighlightedMerchantSuggestion((current) => Math.max(current - 1, 0));
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        const selected = merchantSuggestions.suggestions[highlightedMerchantSuggestion];
                        if (selected) {
                          setMerchantQuery(selected.merchant);
                          setMerchantSuggestionsOpen(false);
                          setHighlightedMerchantSuggestion(-1);
                        }
                      } else if (event.key === "Escape") {
                        setMerchantSuggestionsOpen(false);
                        setHighlightedMerchantSuggestion(-1);
                      }
                    }}
                    className="pl-9"
                    ref={merchantInputRef}
                  />
                  {merchantSuggestionsOpen && merchantSuggestions?.suggestions?.length ? (
                    <div className="absolute z-20 mt-2 w-full rounded-lg border border-border/70 bg-background shadow-lg">
                      <div className="max-h-56 overflow-auto py-1">
                        {merchantSuggestions.suggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.merchant}
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                              highlightedMerchantSuggestion === index ? "bg-muted" : "hover:bg-muted"
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setMerchantQuery(suggestion.merchant);
                              setMerchantSuggestionsOpen(false);
                              setHighlightedMerchantSuggestion(-1);
                            }}
                          >
                            <span className="font-medium">{suggestion.merchant}</span>
                            <span className="text-xs text-muted-foreground">{formatCurrency(suggestion.total)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-full border border-border/60 bg-background px-3">
                <button
                  type="button"
                  onClick={() => setMerchantExact((current) => !current)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition",
                    merchantExact
                      ? "bg-slate-900 text-white"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Exact match
                </button>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-lg bg-transparent px-1">
                <Input
                  type="month"
                  value={merchantStartMonth}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMerchantStartMonth(next);
                    if (next > merchantEndMonth) setMerchantEndMonth(next);
                  }}
                  className="h-8 w-[150px]"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="month"
                  value={merchantEndMonth}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMerchantEndMonth(next);
                    if (next < merchantStartMonth) setMerchantStartMonth(next);
                  }}
                  className="h-8 w-[150px]"
                />
              </div>
            </div>
          </div>

          {merchantQuery.trim().length === 0 && (
            <StateCard title="Search for a merchant" description="Type a merchant name to see monthly spend." />
          )}
          {merchantQuery.trim().length > 0 && merchantTrendsLoading && (
            <StateCard title="Loading merchant trend" description="Pulling monthly spend data." variant="loading" />
          )}
          {merchantQuery.trim().length > 0 && merchantTrendsError && (
            <StateCard title="Error loading merchant trend" description={merchantTrendsError.message} variant="error" />
          )}
          {merchantQuery.trim().length > 0 && !merchantTrendsLoading && !merchantTrendsError && (
            <>
              {merchantTrendSeries.length === 0 ? (
                <StateCard title="No matching transactions" description="Try a different merchant name or range." />
              ) : (
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <LineChart data={merchantTrendSeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tickFormatter={formatMonthWithYear} tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(value) => formatAxisCurrency(value, merchantTrendMax)}
                      tick={{ fontSize: 12 }}
                      domain={[0, () => {
                        const max = Math.max(...merchantTrendSeries.map(d => d.total));
                        return Math.ceil(max * 1.1) || 1000;
                      }]}
                    />
                    <Tooltip
                      cursor={false}
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => formatMonthWithYear(label)}
                    />
                    <Line
                      type="linear"
                      dataKey="total"
                      stroke={COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Merchant Trends */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Spending by Merchant (Month over Month)</CardTitle>
          <div className="flex items-center gap-4">
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
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <LineChart data={merchantChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(value) => formatAxisCurrency(value, merchantVisibleMax)}
                tick={{ fontSize: 12 }}
                domain={[0, Math.ceil(merchantVisibleMax * 1.1) || 1000]}
              />
              <Tooltip cursor={false} content={renderMerchantDotTooltip} />
              <Legend content={(props) => renderClickableLegend(props, hiddenMerchants, toggleMerchant)} />
              {allMerchants.map((merch, idx) => {
                const color = COLORS[idx % COLORS.length];
                return (
                  <Line
                    key={merch.merchant}
                    type="linear"
                    dataKey={merch.merchant}
                    stroke={color}
                    strokeWidth={hiddenMerchants.has(merch.merchant) ? 0 : 2}
                    dot={(props) => renderMerchantDot(props, merch.merchant, color)}
                    activeDot={false}
                    opacity={hiddenMerchants.has(merch.merchant) ? 0 : 1}
                  />
                );
              })}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Category Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Category Breakdown</CardTitle>
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
                  onClick={(data) => openCategoryDrilldown(data.category)}
                  style={{ cursor: 'pointer' }}
                >
                  {(trends?.by_category || [])
                    .filter(c => hideOther ? c.category !== OTHER_CATEGORY : true)
                    .slice(0, Math.min(categoryCount, 10))
                    .map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.category === OTHER_CATEGORY ? OTHER_COLOR : COLORS[idx % COLORS.length]}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{data.category}</p>
                        <p className="font-mono">{formatCurrency(data.total)}</p>
                        <p className="text-sm text-muted-foreground">{data.transaction_count} transactions</p>
                        <p className="text-xs text-primary mt-1">Click to view transactions</p>
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
            <CardTitle className="text-base font-semibold">Top Merchants</CardTitle>
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
                  cursor={false}
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
              <CardTitle className="text-base font-semibold">Budget Tracking by Category</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets
                .filter(b => b.expense_type === 'expense' && b.amount > 0)
                .map(budget => {
                  const categoryData = trends?.monthly_by_category?.find(c => c.category === budget.name);
                  const monthlyBudget = budget.amount;

                  // Create all 12 months with 0 defaults, then fill in actual data
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const actualsByMonth = new Map<string, number>();
                  categoryData?.months.forEach(m => {
                    actualsByMonth.set(formatMonth(m.month), m.total);
                  });

                  const chartData = monthNames.map(monthName => {
                    const actual = actualsByMonth.get(monthName) || 0;
                    const variance = monthlyBudget - actual;
                    const variancePercent = monthlyBudget > 0 ? ((actual - monthlyBudget) / monthlyBudget) * 100 : 0;
                    return {
                      month: monthName,
                      actual,
                      budget: monthlyBudget,
                      variance,
                      variancePercent,
                      overBudget: actual > monthlyBudget
                    };
                  });

                  // Calculate YTD totals
                  const ytdActual = chartData.reduce((sum, d) => sum + d.actual, 0);
                  const ytdBudget = monthlyBudget * 12; // Full year budget
                  const ytdVariancePercent = ytdBudget > 0 ? ((ytdActual - ytdBudget) / ytdBudget) * 100 : 0;
                  const isOverBudget = ytdActual > ytdBudget;

                  return (
                    <Card
                      key={budget.id}
                      className={cn(
                        "border-l-4 cursor-pointer hover:bg-muted/50 transition-colors",
                        isOverBudget ? "border-l-red-500" : "border-l-green-500"
                      )}
                      onClick={() => openCategoryDrilldown(budget.name)}
                    >
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
                              cursor={false}
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
            <CardTitle className="text-base font-semibold">Budget vs Actual (Annual Summary)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trends.budget_comparison.filter(b => b.budget > 0).map((item) => (
                <div
                  key={item.category}
                  className="space-y-1 cursor-pointer hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors"
                  onClick={() => openCategoryDrilldown(item.category)}
                >
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

      {/* Category Drill-down Modal */}
      <CategoryDrilldownModal
        isOpen={drilldownCategory !== null}
        onClose={() => setDrilldownCategory(null)}
        category={drilldownCategory || ''}
        transactions={drilldownTransactions}
        subtitle={drilldownSubtitle || undefined}
      />
      <CategoryDrilldownModal
        isOpen={merchantTransactionsOpen}
        onClose={() => setMerchantTransactionsOpen(false)}
        category={(merchantTrends?.merchant || merchantQuery.trim() || 'Merchant')}
        transactions={merchantTransactions}
      />
    </div>
  );
}
