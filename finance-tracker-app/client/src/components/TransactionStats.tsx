import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCurrencyDollars } from "../lib/utils";
import { Transaction, Budget } from "../lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useState } from "react";

interface TransactionStatsProps {
  transactions: Transaction[];
  budgets: Budget[];
  isLoading: boolean;
  setQuery: (query: string) => void;
  query: string;
}

type SortField = 'category' | 'amount' | 'budgetAmount' | 'difference' | 'percentage' | 'display_order';
type SortDirection = 'asc' | 'desc';


export default function TransactionStats({ transactions, budgets, isLoading, setQuery, query }: TransactionStatsProps) {
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Card className="animate-pulse">
          <CardHeader className="py-2 px-3">
            <div className="h-3 w-1/2 bg-gray-200 rounded" />
            <div className="h-5 w-3/4 bg-gray-300 rounded mt-1" />
          </CardHeader>
        </Card>

        <Card className="animate-pulse">
          <CardContent className="py-2">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-1/3 bg-gray-200 rounded" />
                  <div className="h-2 w-full bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const budgetedExpenses = budgets.filter(b => b.expense_type === 'expense').reduce((acc: Record<string, Budget>, curr) => {
    acc[curr.name] = curr;
    return acc;
  }, {} as Record<string, Budget>);

  const incomes = transactions.filter(t => t.category?.toLowerCase()?.includes('income'))
  const expenses = transactions.filter(t => !String(t.category || 'uncategorized').toLowerCase().includes('income')).map(t => {
    if (!budgetedExpenses[t.category]) {
      return { ...t, category: 'Other' };
    }
    return t;
  });

  const totalEarned = incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalBudgeted = budgets.filter(b => b.expense_type === 'expense')
    .filter(b => transactions.map(t => t.category).includes(b.name))
    .reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);

  const categoryTotals = expenses.reduce((acc, t) => {
    if (t.category?.toLowerCase()?.includes('income')) return acc;

    acc[t.category] = (acc[t.category] || 0) + t?.amount;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(budgetedExpenses)
    .map(([category, budget]) => ({
      category,
      amount: categoryTotals[category] || 0,
      budgetAmount: budget.amount || 0,
      difference: budget.amount - (categoryTotals[category] || 0),
      percentage: Math.round(((categoryTotals[category] || 0) / budget.amount) * 100),
      display_order: budget.display_order
    }))
    .filter(c => c.amount !== 0)
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'category') {
        return multiplier * a.category.localeCompare(b.category);
      }

      if (sortField === 'display_order') {
        return multiplier * (a.display_order - b.display_order);
      }

      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue < bValue) return -1 * multiplier;
      if (aValue > bValue) return 1 * multiplier;
      return 0;
    });

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <CardTitle className="text-xs text-green-700">
                  Total Spent
                </CardTitle>
                <div className="text-lg font-bold text-green-800">
                  {formatCurrency(totalSpent)}
                </div>
              </div>
              {!query && <div>
                <CardTitle className="text-xs text-green-700">
                  Total Earned
                </CardTitle>
                <div className="text-lg font-bold text-green-800">
                  {formatCurrency(totalEarned)}
                </div>
              </div>}
              {query && <div>
                <CardTitle className="text-xs text-green-700">
                  Total Budgeted
                </CardTitle>
                <div className="text-lg font-bold text-green-800">
                  {formatCurrency(totalBudgeted)}
                </div>
              </div>}
              <div>
                <CardTitle className={`text-xs ${totalEarned - totalSpent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Difference
                </CardTitle>
                <div className={`text-lg font-bold ${totalEarned - totalSpent >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {formatCurrency(query ? totalBudgeted - totalSpent : totalEarned - totalSpent)}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Category Details Table */}
        <Card>
          <CardContent className="py-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2 text-xs cursor-pointer hover:bg-gray-50" onClick={() => handleSort('category')}>
                    Category {sortField === 'category' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                  </TableHead>
                  <TableHead className="py-2 text-xs text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('amount')}>
                    Spent {sortField === 'amount' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                  </TableHead>
                  <TableHead className="py-2 text-xs text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('budgetAmount')}>
                    Budget {sortField === 'budgetAmount' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                  </TableHead>
                  <TableHead className="py-2 text-xs text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('difference')}>
                    Diff {sortField === 'difference' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                  </TableHead>
                  <TableHead className="py-2 text-xs text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('percentage')}>
                    % {sortField === 'percentage' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map(({ category, amount, budgetAmount, difference, percentage }) => {
                  const hasExpenses = amount > 0;
                  const isOverBudget = percentage > 100;
                  const rowClassName = !hasExpenses
                    ? 'text-gray-400'
                    : isOverBudget
                      ? 'text-red-700'
                      : 'text-green-700';

                  return (
                    <TableRow
                      key={category}
                      className={`${rowClassName} cursor-pointer hover:bg-gray-50`}
                      onClick={() => setQuery(category)}
                    >
                      <TableCell className="py-1 text-sm font-medium">{category}</TableCell>
                      <TableCell className="py-1 text-sm text-right font-mono">
                        {formatCurrencyDollars(amount)}
                      </TableCell>
                      <TableCell className="py-1 text-sm text-right font-mono">
                        {formatCurrencyDollars(budgetAmount)}
                      </TableCell>
                      <TableCell className="py-1 text-sm text-right font-mono">
                        {formatCurrencyDollars(difference)}
                      </TableCell>
                      <TableCell className="py-1 text-sm text-right">
                        {percentage.toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}