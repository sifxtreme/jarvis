import { useQuery } from "@tanstack/react-query";
import { getRecurringStatus, type RecurringPattern, type Transaction } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Plus, AlertCircle, Clock, Calendar, TrendingUp, X, RotateCcw } from "lucide-react";

// LocalStorage key for dismissed recurring items
const DISMISSED_RECURRING_KEY = 'jarvis_dismissed_recurring';

interface DismissedItem {
  merchant_key: string;
  year: number;
  month: number;
  dismissed_at: string;
}

interface DismissedRecurring {
  items: DismissedItem[];
}

// Helper to get dismissed items from localStorage
const getDismissedItems = (): DismissedRecurring => {
  try {
    const stored = localStorage.getItem(DISMISSED_RECURRING_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading dismissed recurring items:', e);
  }
  return { items: [] };
};

// Helper to save dismissed items to localStorage
const saveDismissedItems = (data: DismissedRecurring) => {
  try {
    localStorage.setItem(DISMISSED_RECURRING_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving dismissed recurring items:', e);
  }
};

// Helper to check if an item is dismissed for a specific month
const isDismissedForMonth = (merchant_key: string, year: number, month: number): boolean => {
  const data = getDismissedItems();
  return data.items.some(item =>
    item.merchant_key === merchant_key &&
    item.year === year &&
    item.month === month
  );
};

// Helper to dismiss an item for a specific month
const dismissForMonth = (merchant_key: string, year: number, month: number) => {
  const data = getDismissedItems();
  // Don't add if already dismissed
  if (!isDismissedForMonth(merchant_key, year, month)) {
    data.items.push({
      merchant_key,
      year,
      month,
      dismissed_at: new Date().toISOString()
    });
    saveDismissedItems(data);
  }
};

// Helper to restore all dismissed items for a month
const restoreAllForMonth = (year: number, month: number) => {
  const data = getDismissedItems();
  data.items = data.items.filter(item => !(item.year === year && item.month === month));
  saveDismissedItems(data);
};

interface RecurringStatusCardProps {
  year: number;
  month: number;
  onQuickAdd: (transaction: Partial<Transaction>) => void;
}

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const formatDay = (day: number): string => {
  return `${day}${getOrdinalSuffix(day)}`;
};

const getStatusIcon = (status: string, isIncome: boolean) => {
  if (isIncome) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  switch (status) {
    case 'overdue':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'due_soon':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'upcoming':
      return <Calendar className="h-4 w-4 text-gray-400" />;
    default:
      return null;
  }
};

const getStatusText = (pattern: RecurringPattern): string => {
  if (pattern.status === 'overdue') {
    return `${pattern.days_difference} day${pattern.days_difference === 1 ? '' : 's'} late`;
  } else if (pattern.status === 'due_soon') {
    return `in ${pattern.days_difference} day${pattern.days_difference === 1 ? '' : 's'}`;
  } else {
    return `in ${pattern.days_difference} day${pattern.days_difference === 1 ? '' : 's'}`;
  }
};

export function RecurringStatusCard({ year, month, onQuickAdd }: RecurringStatusCardProps) {
  const [isOpen, setIsOpen] = useState(false); // Default closed on desktop
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [dismissedCount, setDismissedCount] = useState(0);

  // Load dismissed items on mount and when year/month changes
  useEffect(() => {
    const data = getDismissedItems();
    const dismissed = new Set(
      data.items
        .filter(item => item.year === year && item.month === month)
        .map(item => item.merchant_key)
    );
    setDismissedKeys(dismissed);
    setDismissedCount(dismissed.size);
  }, [year, month]);

  const { data, isLoading } = useQuery({
    queryKey: ['recurring-status', year, month],
    queryFn: () => getRecurringStatus({ year, month }),
  });

  const handleQuickAdd = (pattern: RecurringPattern) => {
    // Create a date for this month with the typical day
    const transactionDate = new Date(year, month - 1, Math.min(pattern.typical_day, 28));

    // For income, amount should be negative
    const amount = pattern.is_income ? -pattern.typical_amount : pattern.typical_amount;

    onQuickAdd({
      transacted_at: transactionDate.toISOString().split('T')[0],
      plaid_name: pattern.plaid_name || pattern.display_name,
      merchant_name: pattern.merchant_name || pattern.display_name,
      amount: amount,
      source: pattern.source,
      category: pattern.category,
      hidden: false,
      reviewed: false,
    });
  };

  const handleDismiss = useCallback((merchant_key: string) => {
    dismissForMonth(merchant_key, year, month);
    setDismissedKeys(prev => {
      const next = new Set(prev);
      next.add(merchant_key);
      return next;
    });
    setDismissedCount(prev => prev + 1);
  }, [year, month]);

  const handleRestoreAll = useCallback(() => {
    restoreAllForMonth(year, month);
    setDismissedKeys(new Set());
    setDismissedCount(0);
  }, [year, month]);

  // Filter out dismissed items
  const filterDismissed = (patterns: RecurringPattern[]) =>
    patterns.filter(p => !dismissedKeys.has(p.merchant_key));

  // Backend already filters to manual sources only (zelle, cash, venmo, bofa)
  const missingExpenses = filterDismissed(
    data?.missing?.filter(p => !p.is_income) || []
  );

  const missingIncome = filterDismissed(
    data?.missing?.filter(p => p.is_income) || []
  );

  const overdueExpenses = missingExpenses.filter(p => p.status === 'overdue');
  const upcomingExpenses = missingExpenses.filter(p => p.status !== 'overdue');
  const overdueIncome = missingIncome.filter(p => p.status === 'overdue');
  const upcomingIncome = missingIncome.filter(p => p.status !== 'overdue');

  if (isLoading) {
    return null;
  }

  // Don't show if nothing to display (but show if there are dismissed items to restore)
  if (missingExpenses.length === 0 && missingIncome.length === 0 && dismissedCount === 0) {
    return null;
  }

  const totalMissing = missingExpenses.length + missingIncome.length;
  const totalOverdue = overdueExpenses.length + overdueIncome.length;

  // Render a single recurring item row
  const renderItem = (pattern: RecurringPattern, isOverdue: boolean) => (
    <div
      key={pattern.merchant_key}
      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {getStatusIcon(pattern.status!, pattern.is_income)}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-mono text-sm truncate",
            pattern.is_income
              ? (isOverdue ? "text-green-600" : "text-green-600/70")
              : (isOverdue ? "" : "text-muted-foreground")
          )}>
            {pattern.display_name}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Day {formatDay(pattern.typical_day)}</span>
            <span>•</span>
            <span className={cn(
              "font-mono",
              pattern.is_income && (isOverdue ? "text-green-600" : "text-green-600/70")
            )}>
              {pattern.is_income ? '+' : '~'}{formatCurrency(pattern.typical_amount)}
            </span>
            <span>•</span>
            <span>{pattern.source}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-xs",
          isOverdue ? "font-medium text-red-500" : "text-muted-foreground"
        )}>
          {getStatusText(pattern)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleQuickAdd(pattern)}
          title="Quick add transaction"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={() => handleDismiss(pattern.merchant_key)}
          title="Dismiss for this month"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="hidden md:block">
      <Card className={cn(
        "mb-2 border-l-4",
        totalOverdue > 0 ? "border-l-red-500" : "border-l-yellow-500"
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {totalOverdue > 0 ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-500" />
                )}
                Missing Recurring ({totalMissing})
                {totalOverdue > 0 && (
                  <span className="text-xs text-red-500 font-normal">
                    ({totalOverdue} overdue)
                  </span>
                )}
                {dismissedCount > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({dismissedCount} dismissed)
                  </span>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="py-2 px-4">
            {totalMissing === 0 && dismissedCount > 0 ? (
              <div className="text-sm text-muted-foreground text-center py-2">
                All items dismissed for this month
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Overdue expenses first */}
                {overdueExpenses.map((pattern) => renderItem(pattern, true))}

                {/* Overdue income */}
                {overdueIncome.map((pattern) => renderItem(pattern, true))}

                {/* Upcoming expenses */}
                {upcomingExpenses.map((pattern) => renderItem(pattern, false))}

                {/* Upcoming income */}
                {upcomingIncome.map((pattern) => renderItem(pattern, false))}
              </div>
            )}

            {/* Restore dismissed items button */}
            {dismissedCount > 0 && (
              <div className="mt-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleRestoreAll}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restore {dismissedCount} dismissed item{dismissedCount === 1 ? '' : 's'}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
