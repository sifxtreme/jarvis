import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBudgets, getTransactions, type TransactionFilters, type Budget, type Transaction } from "../lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";

// Define display modes for the Budget vs. Actual table
type DisplayMode = 'actual' | 'variance' | 'percentage';

// Define column visibility type
type ColumnVisibility = {
  avgActual: boolean;
  [key: string]: boolean; // For month columns (format: "month-1", "month-2", etc.)
};

// Component to display transaction details in a popover
interface TransactionPopoverProps {
  transactions: Transaction[];
  category: string;
  month: number;
  year: number;
}

function TransactionPopover({ transactions, category, month, year }: TransactionPopoverProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-2 text-sm text-muted-foreground font-mono">
        No transactions found for {category} in {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}
      </div>
    );
  }

  // Group transactions by merchant
  const groupedByMerchant: Record<string, { total: number; transactions: Transaction[] }> = {};
  transactions.forEach(transaction => {
    const merchantName = transaction.merchant_name || transaction.plaid_name || 'Unknown';
    if (!groupedByMerchant[merchantName]) {
      groupedByMerchant[merchantName] = { total: 0, transactions: [] };
    }
    groupedByMerchant[merchantName].total += transaction.amount;
    groupedByMerchant[merchantName].transactions.push(transaction);
  });

  // Sort merchants by total amount (descending)
  const sortedMerchants = Object.entries(groupedByMerchant).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="max-h-[400px] font-mono">
      <div className="p-2 font-semibold border-b">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} for {category}
      </div>

      <Tabs defaultValue="all">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="all">All Transactions</TabsTrigger>
          <TabsTrigger value="grouped">Merchant</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="max-h-[300px] overflow-y-auto">
          <div className="divide-y">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-2 text-xs hover:bg-muted">
                <div className="flex justify-between">
                  <span className="font-mono">{formatDate(transaction.transacted_at)}</span>
                  <span className="font-mono">{formatCurrency(transaction.amount)}</span>
                </div>
                <div className="text-muted-foreground font-mono">{transaction.merchant_name || transaction.plaid_name}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grouped" className="max-h-[300px] overflow-y-auto">
          <div className="divide-y">
            {sortedMerchants.map(([merchant, data]) => (
              <div key={merchant} className="p-2 text-xs hover:bg-muted">
                <div className="flex justify-between font-medium">
                  <span className="font-mono">{merchant}</span>
                  <span className="font-mono">{formatCurrency(data.total)}</span>
                </div>
                <div className="text-muted-foreground font-mono">
                  {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''}
                </div>

                {/* Expandable transaction details */}
                <div className="mt-1 pl-2 border-l-2 border-muted space-y-1">
                  {data.transactions.map(transaction => (
                    <div key={transaction.id} className="text-xs flex justify-between">
                      <span className="font-mono">{formatDate(transaction.transacted_at)}</span>
                      <span className="font-mono">{formatCurrency(transaction.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Also update the popover for the Avg Actual cell
function AllTransactionsPopover({ transactions, category, year }: { transactions: Transaction[], category: string, year: number }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-2 text-sm text-muted-foreground font-mono">
        No transactions found for {category} in {year}
      </div>
    );
  }

  // Group transactions by merchant
  const groupedByMerchant: Record<string, { total: number; transactions: Transaction[] }> = {};
  transactions.forEach(transaction => {
    const merchantName = transaction.merchant_name || transaction.plaid_name || 'Unknown';
    if (!groupedByMerchant[merchantName]) {
      groupedByMerchant[merchantName] = { total: 0, transactions: [] };
    }
    groupedByMerchant[merchantName].total += transaction.amount;
    groupedByMerchant[merchantName].transactions.push(transaction);
  });

  // Sort merchants by total amount (descending)
  const sortedMerchants = Object.entries(groupedByMerchant).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="max-h-[400px] font-mono">
      <div className="p-2 font-semibold border-b">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} for {category} in {year}
      </div>

      <Tabs defaultValue="all">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="all">All Transactions</TabsTrigger>
          <TabsTrigger value="grouped">Merchant</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="max-h-[300px] overflow-y-auto">
          <div className="divide-y">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-2 text-xs hover:bg-muted">
                <div className="flex justify-between">
                  <span className="font-mono">{formatDate(transaction.transacted_at)}</span>
                  <span className="font-mono">{formatCurrency(transaction.amount)}</span>
                </div>
                <div className="text-muted-foreground font-mono">{transaction.merchant_name || transaction.plaid_name}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grouped" className="max-h-[300px] overflow-y-auto">
          <div className="divide-y">
            {sortedMerchants.map(([merchant, data]) => (
              <div key={merchant} className="p-2 text-xs hover:bg-muted">
                <div className="flex justify-between font-medium">
                  <span className="font-mono">{merchant}</span>
                  <span className="font-mono">{formatCurrency(data.total)}</span>
                </div>
                <div className="text-muted-foreground font-mono">
                  {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''}
                </div>

                {/* Expandable transaction details */}
                <div className="mt-1 pl-2 border-l-2 border-muted space-y-1">
                  {data.transactions.map(transaction => (
                    <div key={transaction.id} className="text-xs flex justify-between">
                      <span className="font-mono">{formatDate(transaction.transacted_at)}</span>
                      <span className="font-mono">{formatCurrency(transaction.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function YearlyBudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return parseInt(searchParams.get("year") || "2025");
  });

  // Add state for display mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>('actual');

  // Add state for column visibility
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    // Initialize with default visibility settings
    const initialVisibility: ColumnVisibility = { avgActual: false };
    return initialVisibility;
  });

  // Update URL when year changes
  useEffect(() => {
    setSearchParams({ year: selectedYear.toString() }, { replace: true });
  }, [selectedYear, setSearchParams]);

  // Get current date information
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

  // Create an array of all months for the selected year, but only include months up to the current month
  // Use useMemo to prevent recalculation on every render
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      year: selectedYear,
      month: i + 1,
      label: new Date(selectedYear, i).toLocaleString('default', { month: 'long' })
    })).filter(month => {
      // Include all months for past years
      if (month.year < currentYear) return true;
      // For current year, only include months up to the current month
      if (month.year === currentYear) return month.month <= currentMonth;
      // Exclude all months for future years
      return false;
    });
  }, [selectedYear, currentYear, currentMonth]);

  // Initialize column visibility for months when months array changes
  useEffect(() => {
    setColumnVisibility(prev => {
      const newVisibility = { ...prev };

      // Initialize month columns
      months.forEach(month => {
        const columnKey = `month-${month.month}`;
        // If this is a new column or not yet set, initialize it
        if (newVisibility[columnKey] === undefined) {
          // Hide current month by default
          newVisibility[columnKey] = month.month !== currentMonth || month.year !== currentYear;
        }
      });

      return newVisibility;
    });
  }, [months, currentMonth, currentYear]);

  // Fetch budgets for the selected year (we'll fetch all months at once)
  const { data: yearBudgets = [], isLoading: isLoadingBudgets } = useQuery({
    queryKey: ['year-budgets', selectedYear, months.length],
    queryFn: async () => {
      // Fetch budgets for each month of the year
      const budgetPromises = months.map(month =>
        getBudgets({ year: selectedYear, month: month.month, show_hidden: false, show_needs_review: false })
      );

      const budgetResults = await Promise.all(budgetPromises);

      // Create a map of month to budgets
      const monthlyBudgets: Record<number, Budget[]> = {};
      budgetResults.forEach((budgets, index) => {
        monthlyBudgets[index + 1] = budgets;
      });

      return monthlyBudgets;
    },
  });

  // Fetch transactions for the selected year (we'll fetch all months at once)
  const { data: yearTransactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['year-transactions', selectedYear, months.length],
    queryFn: async () => {
      // Fetch transactions for each month of the year
      const transactionPromises = months.map(month =>
        getTransactions({
          year: selectedYear,
          month: month.month,
          show_hidden: false,
          show_needs_review: false,
          query: ''
        })
      );

      const transactionResults = await Promise.all(transactionPromises);

      // Create a map of month to transactions
      const monthlyTransactions: Record<number, Transaction[]> = {};
      transactionResults.forEach((transactions, index) => {
        monthlyTransactions[index + 1] = transactions;
      });

      return monthlyTransactions;
    },
  });

  // Get all unique budget categories across all months
  const allCategories = new Set<string>();
  Object.values(yearBudgets).forEach(monthBudgets => {
    monthBudgets.forEach(budget => {
      allCategories.add(budget.name);
    });
  });

  // Create a map of category to budget amount for each month
  const categoryBudgets: Record<string, Record<number, number>> = {};
  Object.entries(yearBudgets).forEach(([month, budgets]) => {
    budgets.forEach(budget => {
      if (!categoryBudgets[budget.name]) {
        categoryBudgets[budget.name] = {};
      }
      categoryBudgets[budget.name][parseInt(month)] = budget.amount;
    });
  });

  // Create a map of budgeted categories for quick lookup
  const budgetedCategories = new Set<string>();
  Object.values(yearBudgets).forEach(monthBudgets => {
    monthBudgets.forEach(budget => {
      budgetedCategories.add(budget.name);
    });
  });

  // Calculate actual spending for each category and month
  const categoryActuals: Record<string, Record<number, number>> = {};
  Object.entries(yearTransactions).forEach(([month, transactions]) => {
    transactions.forEach(transaction => {
      if (!transaction.category) return;

      // Map non-budgeted categories to "Other"
      const category = budgetedCategories.has(transaction.category)
        ? transaction.category
        : "Other";

      if (!categoryActuals[category]) {
        categoryActuals[category] = {};
      }

      const monthNum = parseInt(month);
      categoryActuals[category][monthNum] =
        (categoryActuals[category][monthNum] || 0) + transaction.amount;
    });
  });

  // Add "Other" to allCategories if there are transactions in the "Other" category
  if (categoryActuals["Other"]) {
    allCategories.add("Other");
  }

  // Store display_order for each category
  const categoryDisplayOrder: Record<string, number> = {};
  Object.values(yearBudgets).forEach(monthBudgets => {
    monthBudgets.forEach(budget => {
      // Only set display_order if it doesn't exist yet or if the new one is lower (higher priority)
      if (categoryDisplayOrder[budget.name] === undefined || budget.display_order < categoryDisplayOrder[budget.name]) {
        categoryDisplayOrder[budget.name] = budget.display_order;
      }
    });
  });

  // Set a high display_order for "Other" category to make it appear at the end
  // But only if "Other" is not a legitimate budget category
  if (allCategories.has("Other") && !budgetedCategories.has("Other")) {
    categoryDisplayOrder["Other"] = 999;
  }

  // Sort categories by display_order first, then by type (income first, then expenses)
  const sortedCategories = Array.from(allCategories).sort((a, b) => {
    // First sort by display_order if available
    const orderA = categoryDisplayOrder[a] !== undefined ? categoryDisplayOrder[a] : 999;
    const orderB = categoryDisplayOrder[b] !== undefined ? categoryDisplayOrder[b] : 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // If display_order is the same, sort income categories first
    const aIsIncome = a.toLowerCase().includes('income');
    const bIsIncome = b.toLowerCase().includes('income');

    if (aIsIncome && !bIsIncome) return -1;
    if (!aIsIncome && bIsIncome) return 1;

    // If both are income or both are expenses, sort alphabetically
    return a.localeCompare(b);
  });

  // Calculate summary data for each month
  const monthlySummary = months
    .filter(month => {
      // Only include months that are completely done (not the current month and year)
      return month.year < currentYear || (month.year === currentYear && month.month < currentMonth);
    })
    .map(month => {
      const monthNum = month.month;

      // Calculate total income for the month
      const totalIncome = Object.entries(categoryActuals)
        .filter(([category]) => category.toLowerCase().includes('income'))
        .reduce((sum, [category, monthValues]) => sum + (monthValues[monthNum] || 0), 0);

      // Calculate total expenses for the month
      const totalExpenses = Object.entries(categoryActuals)
        .filter(([category]) => !category.toLowerCase().includes('income'))
        .reduce((sum, [category, monthValues]) => sum + (monthValues[monthNum] || 0), 0);

      // Calculate savings (income - expenses)
      const savings = totalIncome - totalExpenses;

      // Calculate savings rate (savings / income)
      const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

      return {
        month: monthNum,
        label: month.label,
        totalIncome,
        totalExpenses,
        savings,
        savingsRate
      };
    });

  // Create a map of transactions by category and month for quick lookup
  const transactionsByCategory: Record<string, Record<number, Transaction[]>> = {};

  Object.entries(yearTransactions).forEach(([month, transactions]) => {
    const monthNum = parseInt(month);

    transactions.forEach(transaction => {
      if (!transaction.category) return;

      // Map non-budgeted categories to "Other"
      const category = budgetedCategories.has(transaction.category)
        ? transaction.category
        : "Other";

      if (!transactionsByCategory[category]) {
        transactionsByCategory[category] = {};
      }

      if (!transactionsByCategory[category][monthNum]) {
        transactionsByCategory[category][monthNum] = [];
      }

      transactionsByCategory[category][monthNum].push(transaction);
    });
  });

  const handleYearChange = (year: string) => {
    setSelectedYear(parseInt(year));
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const isLoading = isLoadingBudgets || isLoadingTransactions;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>Yearly Budget Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] bg-gray-100 rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  // Filter visible months based on column visibility
  const visibleMonths = months.filter(month =>
    columnVisibility[`month-${month.month}`] !== false
  );

  return (
    <div className="container mx-auto py-6 font-mono">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Yearly Budget Comparison</h1>
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            ← Transactions
          </a>
        </div>
        <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monthly Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full border-collapse">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-muted/0 [&>th]:p-0">
                  <TableHead className="border border-border bg-muted font-semibold p-2">
                    <div className="px-3 py-2 text-sm font-mono">Month</div>
                  </TableHead>
                  <TableHead className="text-right border border-border bg-muted font-semibold p-2">
                    <div className="px-3 py-2 text-sm font-mono">Income</div>
                  </TableHead>
                  <TableHead className="text-right border border-border bg-muted font-semibold p-2">
                    <div className="px-3 py-2 text-sm font-mono">Expenses</div>
                  </TableHead>
                  <TableHead className="text-right border border-border bg-muted font-semibold p-2">
                    <div className="px-3 py-2 text-sm font-mono">Savings</div>
                  </TableHead>
                  <TableHead className="text-right border border-border bg-muted font-semibold p-2">
                    <div className="px-3 py-2 text-sm font-mono">Savings Rate</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummary.map((summary, index) => (
                  <TableRow key={summary.month} className="hover:bg-muted/80 transition-colors">
                    <TableCell className="font-medium border border-border p-0">
                      <div className="px-3 py-2 text-sm font-mono">{summary.label}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono border border-border p-0">
                      <div className="px-3 py-2 text-sm">{formatCurrency(summary.totalIncome)}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono border border-border p-0">
                      <div className="px-3 py-2 text-sm">{formatCurrency(summary.totalExpenses)}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono border border-border p-0">
                      <div className={`px-3 py-2 text-sm ${summary.savings >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {formatCurrency(summary.savings)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono border border-border p-0">
                      <div className={`px-3 py-2 text-sm ${summary.savingsRate >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {summary.savingsRate.toFixed(1)}%
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Yearly Total Row */}
                <TableRow className="font-bold hover:bg-muted/80 transition-colors border-t-2 border-border">
                  <TableCell className="font-medium border border-border p-0">
                    <div className="px-3 py-2 text-sm font-mono">Yearly Total</div>
                  </TableCell>
                  <TableCell className="text-right font-mono border border-border p-0">
                    <div className="px-3 py-2 text-sm">
                      {formatCurrency(monthlySummary.reduce((sum, month) => sum + month.totalIncome, 0))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono border border-border p-0">
                    <div className="px-3 py-2 text-sm">
                      {formatCurrency(monthlySummary.reduce((sum, month) => sum + month.totalExpenses, 0))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono border border-border p-0">
                    {(() => {
                      const yearlySavings = monthlySummary.reduce((sum, month) => sum + month.savings, 0);
                      return (
                        <div className={`px-3 py-2 text-sm ${yearlySavings >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {formatCurrency(yearlySavings)}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-mono border border-border p-0">
                    {(() => {
                      const yearlyIncome = monthlySummary.reduce((sum, month) => sum + month.totalIncome, 0);
                      const yearlySavings = monthlySummary.reduce((sum, month) => sum + month.savings, 0);
                      const yearlySavingsRate = yearlyIncome > 0 ? (yearlySavings / yearlyIncome) * 100 : 0;

                      return (
                        <div className={`px-3 py-2 text-sm ${yearlySavingsRate >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {yearlySavingsRate.toFixed(1)}%
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Budget vs Actual Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{selectedYear} Budget vs. Actual</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={displayMode} onValueChange={(value) => setDisplayMode(value as DisplayMode)}>
              <SelectTrigger className="w-44 h-8">
                <SelectValue placeholder="Display Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="actual">Actual Amount</SelectItem>
                <SelectItem value="variance">Variance</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Settings2 className="h-4 w-4" />
                  <span>Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.avgActual}
                  onCheckedChange={() => toggleColumnVisibility('avgActual')}
                >
                  Avg Actual
                </DropdownMenuCheckboxItem>

                {months.map(month => (
                  <DropdownMenuCheckboxItem
                    key={`visibility-${month.month}`}
                    checked={columnVisibility[`month-${month.month}`] !== false}
                    onCheckedChange={() => toggleColumnVisibility(`month-${month.month}`)}
                  >
                    {month.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full border-collapse">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-muted/0 [&>th]:p-0">
                  <TableHead className="w-[100px] min-w-[100px] border border-border bg-muted font-semibold p-2">
                    <div className="px-2 py-1 text-sm font-mono">Category</div>
                  </TableHead>
                  <TableHead className="text-right border border-border bg-muted font-semibold w-[100px] min-w-[100px] p-2">
                    <div className="px-2 py-1 text-sm font-mono">Budget</div>
                  </TableHead>

                  {/* Conditionally render Avg Actual column */}
                  {columnVisibility.avgActual && (
                    <TableHead className="text-right border border-border bg-muted font-semibold w-[150px] min-w-[150px] p-2">
                      <div className="px-2 py-1 text-sm font-mono">
                        {displayMode === 'variance' ? 'Avg Variance' :
                         displayMode === 'percentage' ? 'Avg %' :
                         'Avg Actual'}
                      </div>
                    </TableHead>
                  )}

                  {/* Only render visible month columns */}
                  {visibleMonths.map((month) => (
                    <TableHead
                      key={`${month.year}-${month.month}`}
                      className="text-right border border-border bg-muted font-semibold w-[120px] min-w-[120px] p-2"
                    >
                      <div className="px-2 py-1 text-sm font-mono">{month.label}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category, rowIndex) => {
                  const isIncome = category.toLowerCase().includes('income');
                  const isLastRow = rowIndex === sortedCategories.length - 1;

                  // Calculate average budget for the category
                  const budgetValues = Object.values(categoryBudgets[category] || {});
                  const avgBudget = budgetValues.length > 0
                    ? budgetValues.reduce((sum, val) => sum + val, 0) / budgetValues.length
                    : 0;

                  // Calculate average actual spending for the category across all months
                  const actualValues = Object.values(categoryActuals[category] || {});
                  const avgActual = actualValues.length > 0
                    ? actualValues.reduce((sum, val) => sum + val, 0) / actualValues.length
                    : 0;

                  // Calculate variance for the average
                  const avgVariance = isIncome
                    ? avgActual - avgBudget  // For income, positive variance means over budget (good)
                    : avgBudget - avgActual; // For expenses, positive variance means under budget (good)

                  // Determine if average actual is positive compared to budget
                  const isAvgPositive = isIncome
                    ? avgActual >= avgBudget
                    : avgActual <= avgBudget;

                  return (
                    <TableRow
                      key={category}
                      className={`
                        hover:bg-muted/80 transition-colors
                        ${isLastRow ? 'border-b border-border' : ''}
                      `}
                    >
                      <TableCell className="font-mono border border-border p-0">
                        <div className="px-2 py-1 text-sm">{category}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono border border-border p-0">
                        <div className="px-2 py-1 text-sm">{formatCurrency(avgBudget)}</div>
                      </TableCell>

                      {/* Conditionally render Avg Actual cell */}
                      {columnVisibility.avgActual && (
                        <TableCell className="text-right font-mono border border-border p-0">
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className={`px-2 py-1 text-sm cursor-pointer ${
                                avgVariance >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {(() => {
                                  // Calculate percentage of budget
                                  const percentage = avgBudget !== 0
                                    ? (avgActual / avgBudget) * 100
                                    : avgActual > 0 ? Infinity : 0;

                                  // Determine what value to display based on the display mode
                                  let displayValue: string;
                                  if (displayMode === 'variance') {
                                    displayValue = formatCurrency(Math.abs(avgVariance));
                                    if (avgVariance === 0) {
                                      displayValue = formatCurrency(0);
                                    } else if (avgVariance < 0) {
                                      displayValue = `-${displayValue}`;
                                    } else {
                                      displayValue = `+${displayValue}`;
                                    }
                                  } else if (displayMode === 'percentage') {
                                    displayValue = avgBudget === 0
                                      ? avgActual === 0 ? '0%' : '∞%'
                                      : `${percentage.toFixed(1)}%`;
                                  } else {
                                    // Default to actual amount
                                    displayValue = formatCurrency(avgActual);
                                  }
                                  return displayValue;
                                })()}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-96 p-0">
                              <AllTransactionsPopover
                                transactions={Object.entries(transactionsByCategory[category] || {}).flatMap(([month, transactions]) => transactions)}
                                category={category}
                                year={selectedYear}
                              />
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                      )}

                      {/* Only render visible month cells */}
                      {visibleMonths.map((month) => {
                        const budget = categoryBudgets[category]?.[month.month] || 0;
                        const actual = categoryActuals[category]?.[month.month] || 0;

                        // Calculate variance (how much over/under budget)
                        const variance = isIncome
                          ? actual - budget  // For income, positive variance means over budget (good)
                          : budget - actual; // For expenses, positive variance means under budget (good)

                        // Calculate percentage of budget
                        const percentage = budget !== 0
                          ? (actual / budget) * 100
                          : actual > 0 ? Infinity : 0;

                        // For income, we want to be over budget (green)
                        // For expenses, we want to be under budget (green)
                        const isPositive = isIncome
                          ? actual >= budget
                          : actual <= budget;

                        // Determine what value to display based on the display mode
                        let displayValue: string;
                        if (displayMode === 'variance') {
                          displayValue = formatCurrency(Math.abs(variance));
                          if (variance === 0) {
                            displayValue = formatCurrency(0);
                          } else if ((isIncome && variance < 0) || (!isIncome && variance < 0)) {
                            displayValue = `-${displayValue}`;
                          } else {
                            displayValue = `+${displayValue}`;
                          }
                        } else if (displayMode === 'percentage') {
                          displayValue = budget === 0
                            ? actual === 0 ? '0%' : '∞%'
                            : `${percentage.toFixed(1)}%`;
                        } else {
                          // Default to actual amount
                          displayValue = formatCurrency(actual);
                        }

                        return (
                          <TableCell
                            key={`${category}-${month.month}`}
                            className="text-right font-mono border border-border p-0"
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <div
                                  className={`px-2 py-1 text-sm cursor-pointer ${
                                    isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  {displayValue}
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-96 p-0">
                                <TransactionPopover
                                  transactions={transactionsByCategory[category]?.[month.month] || []}
                                  category={category}
                                  month={month.month}
                                  year={month.year}
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}