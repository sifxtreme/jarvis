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
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, AlertCircle, Clock, Calendar, TrendingUp } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(true);

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

  // Filter to only show manual sources that need attention (for expenses)
  const manualSources = ['zelle', 'cash', 'venmo', 'bofa'];
  const missingManual = data?.missing?.filter(p =>
    !p.is_income && manualSources.includes(p.source?.toLowerCase() || '')
  ) || [];

  const missingAuto = data?.missing?.filter(p =>
    !p.is_income && !manualSources.includes(p.source?.toLowerCase() || '')
  ) || [];

  // Income items (show all, regardless of source)
  const missingIncome = data?.missing?.filter(p => p.is_income) || [];

  const overdueManual = missingManual.filter(p => p.status === 'overdue');
  const upcomingManual = missingManual.filter(p => p.status !== 'overdue');
  const overdueIncome = missingIncome.filter(p => p.status === 'overdue');
  const upcomingIncome = missingIncome.filter(p => p.status !== 'overdue');

  if (isLoading) {
    return null;
  }

  // Don't show if nothing to display
  if (missingManual.length === 0 && missingIncome.length === 0) {
    return null;
  }

  const totalMissing = missingManual.length + missingIncome.length;
  const totalOverdue = overdueManual.length + overdueIncome.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "mb-4 border-l-4",
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
            <div className="space-y-1">
              {/* Overdue expenses first */}
              {overdueManual.map((pattern) => (
                <div
                  key={pattern.merchant_key}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(pattern.status!, pattern.is_income)}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate">
                        {pattern.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Day {formatDay(pattern.typical_day)}</span>
                        <span>•</span>
                        <span className="font-mono">~{formatCurrency(pattern.typical_amount)}</span>
                        <span>•</span>
                        <span>{pattern.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-red-500">
                      {getStatusText(pattern)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleQuickAdd(pattern)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Overdue income */}
              {overdueIncome.map((pattern) => (
                <div
                  key={pattern.merchant_key}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(pattern.status!, pattern.is_income)}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate text-green-600">
                        {pattern.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Day {formatDay(pattern.typical_day)}</span>
                        <span>•</span>
                        <span className="font-mono text-green-600">+{formatCurrency(pattern.typical_amount)}</span>
                        <span>•</span>
                        <span>{pattern.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-red-500">
                      {getStatusText(pattern)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleQuickAdd(pattern)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Upcoming expenses */}
              {upcomingManual.map((pattern) => (
                <div
                  key={pattern.merchant_key}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(pattern.status!, pattern.is_income)}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate text-muted-foreground">
                        {pattern.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Day {formatDay(pattern.typical_day)}</span>
                        <span>•</span>
                        <span className="font-mono">~{formatCurrency(pattern.typical_amount)}</span>
                        <span>•</span>
                        <span>{pattern.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {getStatusText(pattern)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleQuickAdd(pattern)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Upcoming income */}
              {upcomingIncome.map((pattern) => (
                <div
                  key={pattern.merchant_key}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(pattern.status!, pattern.is_income)}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate text-green-600/70">
                        {pattern.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Day {formatDay(pattern.typical_day)}</span>
                        <span>•</span>
                        <span className="font-mono text-green-600/70">+{formatCurrency(pattern.typical_amount)}</span>
                        <span>•</span>
                        <span>{pattern.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {getStatusText(pattern)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleQuickAdd(pattern)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Show auto-sync missing as a subtle note */}
            {missingAuto.length > 0 && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                {missingAuto.length} auto-synced recurring transaction{missingAuto.length === 1 ? '' : 's'} also missing
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
