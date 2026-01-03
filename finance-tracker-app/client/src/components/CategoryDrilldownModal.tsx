import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "../lib/utils";
import { Transaction } from "../lib/api";
import { useState } from "react";

interface CategoryDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: string;
  transactions: Transaction[];
  subtitle?: string;
}

type SortField = 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

export function CategoryDrilldownModal({
  isOpen,
  onClose,
  category,
  transactions,
  subtitle,
}: CategoryDrilldownModalProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Group by merchant for summary
  const merchantTotals = transactions.reduce((acc, t) => {
    const merchant = t.merchant_name || t.plaid_name || 'Unknown';
    if (!acc[merchant]) acc[merchant] = 0;
    acc[merchant] += t.amount;
    return acc;
  }, {} as Record<string, number>);

  const sortedTransactions = [...transactions].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'date') {
      return multiplier * (new Date(a.transacted_at).getTime() - new Date(b.transacted_at).getTime());
    } else {
      return multiplier * (a.amount - b.amount);
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{category} Transactions</DialogTitle>
          {subtitle && <div className="text-xs text-muted-foreground font-mono">{subtitle}</div>}
          <div className="text-sm text-muted-foreground font-mono">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} totaling {formatCurrency(total)}
          </div>
        </DialogHeader>

        {/* Merchant breakdown summary */}
        {transactions.length > 3 && (
          <div className="mb-4 mt-2 p-3 bg-muted/50 rounded-md border">
            <div className="text-xs font-medium mb-2 text-muted-foreground">By Merchant</div>
            <div className="grid gap-1 max-h-[150px] overflow-y-auto pr-1">
              {Object.entries(merchantTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([merchant, amount]) => (
                  <div key={merchant} className="flex justify-between text-xs">
                    <span className="font-mono truncate max-w-[200px]">{merchant}</span>
                    <span className="font-mono font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sort controls */}
        <div className="flex justify-between mb-3 px-1 text-xs text-muted-foreground border-b pb-1">
          <button
            className={`flex items-center font-mono ${sortField === 'date' ? 'font-bold text-foreground' : ''}`}
            onClick={() => handleSort('date')}
          >
            Date
            {sortField === 'date' && (
              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          <button
            className={`flex items-center font-mono ${sortField === 'amount' ? 'font-bold text-foreground' : ''}`}
            onClick={() => handleSort('amount')}
          >
            Amount
            {sortField === 'amount' && (
              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        </div>

        {/* Transaction list */}
        <div className="space-y-4">
          {sortedTransactions.map(transaction => (
            <div key={transaction.id} className="border-b pb-2">
              <div className="flex justify-between">
                <div className="font-mono font-medium truncate max-w-[250px]" title={transaction.plaid_name}>
                  {transaction.merchant_name || transaction.plaid_name}
                </div>
                <div className="font-mono font-bold">{formatCurrency(transaction.amount)}</div>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <div className="font-mono">{formatDate(transaction.transacted_at)}</div>
                <div className="font-mono text-xs">{transaction.source}</div>
              </div>
            </div>
          ))}
        </div>

        {transactions.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No transactions found for this category.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
