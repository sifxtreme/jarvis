import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EyeOff,
  Eye,
  CheckCircle,
  AlertCircle,
  Wallet,
  Send,
  DollarSign,
  PencilIcon,
  ChevronUp,
  ChevronDown,
  Copy,
  Scissors
} from "lucide-react";
import { FaCcAmex, FaCcVisa, FaUniversity, FaCreditCard, FaAmazon } from 'react-icons/fa';
import { api, Transaction } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "./TransactionModal";
import { SplitTransactionModal } from "./SplitTransactionModal";

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  onUpdate?: () => void;
}

type SortField = 'transacted_at' | 'plaid_name' | 'merchant_name' | 'category' | 'amount' | 'source';
type SortDirection = 'asc' | 'desc';

const getSourceIcon = (source: string | null) => {
  if (!source) return null;

  switch(source.toLowerCase()) {
    case 'amex': return <FaCcAmex className="h-5 w-5 text-blue-600 transform scale-90 antialiased" />;
    case 'hafsa_chase': return <FaCcVisa className="h-5 w-5 text-blue-500 transform scale-90 antialiased" />;
    case 'asif_chase': return <FaCcVisa className="h-5 w-5 text-blue-500 transform scale-90 antialiased" />;
    case 'asif_citi': return <FaCreditCard className="h-5 w-5 text-purple-500 transform scale-90 antialiased" />;
    case 'cash': return <Wallet className="h-5 w-5 text-green-500 transform scale-90 antialiased" />;
    case 'bofa': return <FaUniversity className="h-5 w-5 text-red-600 transform scale-90 antialiased" />;
    case 'zelle': return <Send className="h-5 w-5 text-purple-600 transform scale-90 antialiased" />;
    case 'venmo': return <DollarSign className="h-5 w-5 text-blue-400 transform scale-90 antialiased" />;
    default: return null;
  }
};

// Function to check if a merchant is Amazon
const isAmazonMerchant = (plaidName: string | null): boolean => {
  if (!plaidName) return false;
  return /amazon|amzn/i.test(plaidName);
};

export default function TransactionTable({ transactions = [], isLoading, onUpdate }: TransactionTableProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState<Transaction | null>(null);
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sortField, setSortField] = useState<SortField>('transacted_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Calculate total amount of all transactions, excluding those with "Income" in the category
  const totalExpenses = transactions
    .filter(transaction => !transaction.category?.includes('Income'))
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const sortedTransactions = [...transactions].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (sortField === 'amount') {
      return (Number(aValue) - Number(bValue)) * direction;
    }

    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return String(aValue).localeCompare(String(bValue)) * direction;
  });

  const handleEditSubmit = async (formData: FormData) => {
    if (!editingTransaction) return;

    try {
      await api.updateTransaction(editingTransaction.id, {
        transacted_at: formData.get('transacted_at') as string,
        plaid_name: formData.get('plaid_name') as string,
        merchant_name: formData.get('merchant_name') as string,
        category: formData.get('category') as string,
        source: formData.get('source') as string,
        amount: parseFloat(formData.get('amount') as string),
        hidden: formData.get('hidden') === 'on',
        reviewed: formData.get('reviewed') === 'on'
      });
      setEditingTransaction(null);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update transaction:', error);
    }
  };

  const handleCreateSubmit = async (formData: FormData) => {
    try {
      await api.createTransaction({
        transacted_at: formData.get('transacted_at') as string,
        plaid_name: formData.get('plaid_name') as string,
        merchant_name: formData.get('merchant_name') as string,
        category: formData.get('category') as string,
        source: formData.get('source') as string,
        amount: parseFloat(formData.get('amount') as string),
        hidden: false,
        reviewed: false
      });
      setIsCreating(false);
      setDuplicatingTransaction(null);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to create transaction:', error);
    }
  };

  const handleSplitSubmit = async (originalTransaction: Transaction, splitTransactions: Omit<Transaction, 'id'>[]) => {
    try {
      // Update the original transaction with the new amount
      await api.updateTransaction(originalTransaction.id, {
        transacted_at: originalTransaction.transacted_at,
        plaid_name: originalTransaction.plaid_name,
        merchant_name: originalTransaction.merchant_name,
        category: originalTransaction.category,
        source: originalTransaction.source,
        amount: originalTransaction.amount,
        hidden: originalTransaction.hidden,
        reviewed: originalTransaction.reviewed
      });

      // Create the new split transactions
      for (const splitTransaction of splitTransactions) {
        await api.createTransaction({
          transacted_at: splitTransaction.transacted_at,
          plaid_name: splitTransaction.plaid_name,
          merchant_name: splitTransaction.merchant_name,
          category: splitTransaction.category,
          source: splitTransaction.source,
          amount: splitTransaction.amount,
          hidden: splitTransaction.hidden,
          reviewed: splitTransaction.reviewed
        });
      }

      setSplittingTransaction(null);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to split transaction:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <TransactionModal
        open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSubmit={handleEditSubmit}
        transaction={editingTransaction || undefined}
        title="Edit Transaction"
      />

      <TransactionModal
        open={isCreating || !!duplicatingTransaction}
        onClose={() => {
          setIsCreating(false);
          setDuplicatingTransaction(null);
        }}
        onSubmit={handleCreateSubmit}
        transaction={duplicatingTransaction || undefined}
        title={duplicatingTransaction ? "Duplicate Transaction" : "Add Transaction"}
        isDuplicating={!!duplicatingTransaction}
      />

      <SplitTransactionModal
        open={!!splittingTransaction}
        onClose={() => setSplittingTransaction(null)}
        onSubmit={handleSplitSubmit}
        transaction={splittingTransaction}
      />

      {/* Floating total amount div */}
      <div className="fixed bottom-4 left-4 z-50 bg-background shadow-lg rounded-lg p-3 border border-border flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <div>
          <div className="font-mono font-bold">{formatCurrency(totalExpenses)}</div>
        </div>
      </div>

      {/* Desktop view */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[120px]"
                onClick={() => {
                  if (sortField === 'transacted_at') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('transacted_at');
                    setSortDirection('desc');
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  Date
                  {sortField === 'transacted_at' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[180px]"
                onClick={() => {
                  if (sortField === 'merchant_name') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('merchant_name');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  Merchant
                  {sortField === 'merchant_name' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[150px]"
                onClick={() => {
                  if (sortField === 'category') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('category');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  Category
                  {sortField === 'category' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 w-[120px]"
                onClick={() => {
                  if (sortField === 'source') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('source');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  Source
                  {sortField === 'source' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50 w-[120px]"
                onClick={() => {
                  if (sortField === 'amount') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('amount');
                    setSortDirection('desc');
                  }
                }}
              >
                <div className="flex items-center justify-end gap-2">
                  Amount
                  {sortField === 'amount' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              className="hover:bg-muted/50 cursor-pointer"
              onClick={() => setIsCreating(true)}
            >
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Click to add a new transaction...
              </TableCell>
            </TableRow>

            {sortedTransactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className={cn(
                  "transition-colors",
                  editingTransaction?.id === transaction.id
                    ? "bg-yellow-50 dark:bg-yellow-900/20"
                    : "hover:bg-muted/50"
                )}
              >
                <TableCell className="font-mono">{formatDate(transaction.transacted_at)}</TableCell>
                <TableCell className="font-mono">
                  <div className="flex items-center gap-1">
                    {isAmazonMerchant(transaction.plaid_name) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <FaAmazon className="h-4 w-4 text-[#FF9900]" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Amazon Purchase</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {transaction.merchant_name || transaction.plaid_name}
                  </div>
                </TableCell>
                <TableCell className="font-mono">{transaction.category || 'Uncategorized'}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger>
                          {getSourceIcon(transaction.source)}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono">{transaction.source} transaction</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-mono">{transaction.source}</span>
                    </div>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <div className="flex items-center space-x-2">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center w-6 h-6">
                          {transaction.hidden ? (
                            <EyeOff className="h-4 w-4 text-gray-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{transaction.hidden ? 'Hidden Transaction' : 'Visible Transaction'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center w-6 h-6">
                          {transaction.reviewed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{transaction.reviewed ? 'Reviewed' : 'Needs Review'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          className="flex items-center justify-center w-6 h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDuplicatingTransaction(transaction);
                          }}
                          disabled={!!transaction.amortized_months?.length}
                        >
                          <Copy className={`h-4 w-4 ${transaction.amortized_months?.length ? 'text-gray-400' : 'text-purple-500 hover:text-purple-700'}`} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{transaction.amortized_months?.length ? 'Cannot duplicate amortized transaction' : 'Duplicate Transaction'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          className="flex items-center justify-center w-6 h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSplittingTransaction(transaction);
                          }}
                          disabled={!!transaction.amortized_months?.length}
                        >
                          <Scissors className={`h-4 w-4 ${transaction.amortized_months?.length ? 'text-gray-400' : 'text-orange-500 hover:text-orange-700'}`} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{transaction.amortized_months?.length ? 'Cannot split amortized transaction' : 'Split Transaction'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          className="flex items-center justify-center w-6 h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTransaction(transaction);
                          }}
                          disabled={!!transaction.amortized_months?.length}
                        >
                          <PencilIcon className={`h-4 w-4 ${transaction.amortized_months?.length ? 'text-gray-400' : 'text-blue-500 hover:text-blue-700'}`} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{transaction.amortized_months?.length ? 'Cannot edit amortized transaction' : 'Edit Transaction'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <Button
          onClick={() => setIsCreating(true)}
          className="w-full mb-4"
        >
          Add Transaction
        </Button>
        {sortedTransactions.map((transaction) => (
          <Card
            key={transaction.id}
            className={cn(
              "p-4 mb-4 transition-colors",
              editingTransaction?.id === transaction.id
                ? "bg-yellow-50 dark:bg-yellow-900/20"
                : ""
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-mono font-medium">
                  <div className="flex items-center gap-1">
                    {isAmazonMerchant(transaction.plaid_name) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <FaAmazon className="h-4 w-4 text-[#FF9900]" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Amazon Purchase</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {transaction.merchant_name || transaction.plaid_name}
                  </div>
                </div>
                <div className="font-mono text-sm text-muted-foreground">{formatDate(transaction.transacted_at)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-medium">{formatCurrency(transaction.amount)}</div>
                <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground mt-2">
                  {getSourceIcon(transaction.source)}
                  <span className="font-mono">{transaction.source}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="font-mono text-sm">{transaction.category || 'Uncategorized'}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDuplicatingTransaction(transaction);
                  }}
                  disabled={!!transaction.amortized_months?.length}
                  className={`p-2 hover:bg-muted rounded-full flex items-center justify-center ${transaction.amortized_months?.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Copy className={`h-4 w-4 ${transaction.amortized_months?.length ? 'text-gray-400' : 'text-purple-500'}`} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSplittingTransaction(transaction);
                  }}
                  disabled={!!transaction.amortized_months?.length}
                  className={`p-2 hover:bg-muted rounded-full flex items-center justify-center ${transaction.amortized_months?.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Scissors className={`h-4 w-4 ${transaction.amortized_months?.length ? 'text-gray-400' : 'text-orange-500'}`} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTransaction(transaction);
                  }}
                  disabled={!!transaction.amortized_months?.length}
                  className={`p-2 hover:bg-muted rounded-full flex items-center justify-center ${transaction.amortized_months?.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <PencilIcon className={`h-4 w-4 ${transaction.amortized_months?.length ? 'text-gray-400' : 'text-blue-500'}`} />
                </button>
                <button className="p-2 hover:bg-muted rounded-full flex items-center justify-center">
                  {transaction.hidden ? (
                    <EyeOff className="h-4 w-4 text-gray-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </button>
                <button className="p-2 hover:bg-muted rounded-full flex items-center justify-center">
                  {transaction.reviewed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}