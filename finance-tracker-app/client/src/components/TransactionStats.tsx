import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCurrencyDollars, formatDate } from "../lib/utils";
import { Transaction, Budget } from "../lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useState } from "react";

interface TransactionStatsProps {
  transactions: Transaction[];
  budgets: Budget[];
  isLoading: boolean;
  query: string;
}

type SortField = 'category' | 'amount' | 'budgetAmount' | 'difference' | 'percentage' | 'display_order';
type SortDirection = 'asc' | 'desc';


export default function TransactionStats({ transactions, budgets, isLoading, query }: TransactionStatsProps) {
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTransactions, setSelectedTransactions] = useState<(Transaction & { original_category?: string })[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      return { ...t, category: 'Other', original_category: t.category };
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
      transactions: expenses.filter(t => t.category === category),
      amount: categoryTotals[category] || 0,
      budgetAmount: budget.amount || 0,
      difference: budget.amount - (categoryTotals[category] || 0),
      percentage: Math.round(((categoryTotals[category] || 0) / budget.amount) * 100),
      display_order: budget.display_order,
    }))
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
    <div className="h-full font-mono">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-lg">
                {query ? `Filtered Stats` : `Monthly Summary`}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Income</div>
                  <div className="text-lg font-bold">{formatCurrency(totalEarned)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Spent</div>
                  <div className="text-lg font-bold">{formatCurrency(totalSpent)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className={`text-lg font-bold ${totalEarned - totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalEarned - totalSpent)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="font-mono">Transaction Details</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {selectedTransactions.map(transaction => (
                    <div key={transaction.id} className="border-b pb-2">
                      <div className="flex justify-between">
                        <div className="font-mono font-medium">{transaction.merchant_name || transaction.plaid_name}</div>
                        <div className="font-mono font-bold">{formatCurrency(transaction.amount)}</div>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <div className="font-mono">{formatDate(transaction.transacted_at)}</div>
                        <div className="font-mono">{transaction.original_category || transaction.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">
                  Budget vs. Actual
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-1 text-xs font-medium cursor-pointer" onClick={() => handleSort('category')}>
                        Category
                      </TableHead>
                      <TableHead className="py-1 text-xs text-right cursor-pointer" onClick={() => handleSort('amount')}>
                        Actual
                      </TableHead>
                      <TableHead className="py-1 text-xs text-right cursor-pointer" onClick={() => handleSort('budgetAmount')}>
                        Budget
                      </TableHead>
                      <TableHead className="py-1 text-xs text-right cursor-pointer" onClick={() => handleSort('difference')}>
                        Diff
                      </TableHead>
                      <TableHead className="py-1 text-xs text-right cursor-pointer" onClick={() => handleSort('percentage')}>
                        %
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCategories.map(({ category, amount, budgetAmount, difference, percentage, transactions }) => {
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
                          onClick={() => {
                            setSelectedTransactions(transactions);
                            setIsModalOpen(true);
                          }}
                        >
                          <TableCell className="py-1 text-xs font-medium font-mono">{category}</TableCell>
                          <TableCell className="py-1 text-xs text-right font-mono">
                            {formatCurrencyDollars(amount)}
                          </TableCell>
                          <TableCell className="py-1 text-xs text-right font-mono">
                            {formatCurrencyDollars(budgetAmount)}
                          </TableCell>
                          <TableCell className="py-1 text-xs text-right font-mono">
                            {formatCurrencyDollars(difference)}
                          </TableCell>
                          <TableCell className="py-1 text-xs text-right font-mono">
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
        </div>
      </ScrollArea>
    </div>
  );
}