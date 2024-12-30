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
  ChevronDown
} from "lucide-react";
import { FaCcAmex, FaCcVisa, FaUniversity, FaCreditCard } from 'react-icons/fa';
import { api, Transaction } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  onUpdate?: () => void;
}

type SortField = 'transacted_at' | 'plaid_name' | 'merchant_name' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

const getSourceIcon = (source: string | null) => {
  if (!source) return null;

  switch(source.toLowerCase()) {
    case 'amex': return <FaCcAmex className="h-4 w-4" />;
    case 'hafsa_chase': return <FaCcVisa className="h-4 w-4" />;
    case 'asif_chase': return <FaCcVisa className="h-4 w-4" />;
    case 'asif_citi': return <FaCreditCard className="h-4 w-4" />;
    case 'cash': return <Wallet className="h-4 w-4" />;
    case 'bofa': return <FaUniversity className="h-4 w-4" />;
    case 'zelle': return <Send className="h-4 w-4" />;
    case 'venmo': return <DollarSign className="h-4 w-4" />;
    default: return null;
  }
};

export default function TransactionTable({ transactions = [], isLoading, onUpdate }: TransactionTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempHidden, setTempHidden] = useState<boolean>(false);
  const [tempReviewed, setTempReviewed] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('transacted_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (editingId) {
      const transaction = transactions.find(t => t.id === editingId);
      if (transaction) {
        setTempHidden(transaction.hidden);
        setTempReviewed(transaction.reviewed);
      }
    }
  }, [editingId, transactions]);

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

  const renderMobileTransaction = (transaction: Transaction) => {
    if (editingId === transaction.id) {
      return (
        <Card className="p-4 mb-4 space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <input
              type="date"
              name="transacted_at"
              defaultValue={transaction.transacted_at.split('T')[0]}
              className="w-full p-2 border rounded"
              form={`edit-form-${transaction.id}`}
            />
          </div>

          <div className="space-y-2">
            <Label>Vendor</Label>
            <input
              type="text"
              name="plaid_name"
              defaultValue={transaction.plaid_name}
              className="w-full p-2 border rounded"
              form={`edit-form-${transaction.id}`}
            />
          </div>

          <div className="space-y-2">
            <Label>Merchant</Label>
            <input
              type="text"
              name="merchant_name"
              defaultValue={transaction.merchant_name}
              className="w-full p-2 border rounded"
              form={`edit-form-${transaction.id}`}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <input
              type="text"
              name="category"
              defaultValue={transaction.category}
              className="w-full p-2 border rounded"
              form={`edit-form-${transaction.id}`}
            />
          </div>

          <div className="space-y-2">
            <Label>Source</Label>
            <input
              type="text"
              name="source"
              defaultValue={transaction.source}
              className="w-full p-2 border rounded"
              form={`edit-form-${transaction.id}`}
            />
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <input
              type="number"
              name="amount"
              defaultValue={transaction.amount}
              step="0.01"
              className="w-full p-2 border rounded text-right font-mono"
              form={`edit-form-${transaction.id}`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="submit"
              form={`edit-form-${transaction.id}`}
              size="sm"
              variant="default"
            >
              Save
            </Button>
            <Button
              type="button"
              onClick={() => setEditingId(null)}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-4 mb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-medium">{transaction.merchant_name || transaction.plaid_name}</div>
            <div className="text-sm text-muted-foreground">{formatDate(transaction.transacted_at)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono font-medium">{formatCurrency(transaction.amount)}</div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {getSourceIcon(transaction.source)}
              <span>{transaction.source}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {transaction.category || 'Uncategorized'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingId(transaction.id)}
              className="p-2 hover:bg-muted rounded-full"
            >
              <PencilIcon className="h-4 w-4 text-blue-500" />
            </button>
            <button className="p-2 hover:bg-muted rounded-full">
              {transaction.hidden ? (
                <EyeOff className="h-4 w-4 text-gray-500" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
            <button className="p-2 hover:bg-muted rounded-full">
              {transaction.reviewed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
            </button>
          </div>
        </div>
      </Card>
    );
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
      {/* Desktop view */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
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
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  if (sortField === 'plaid_name') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('plaid_name');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  Vendor
                  {sortField === 'plaid_name' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
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
                className="cursor-pointer hover:bg-muted/50"
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
              <TableHead>Source</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
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
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              className={cn(
                "hover:bg-muted/50 cursor-pointer",
                isCreating && "shadow-[0_0_15px_rgba(0,0,0,0.1)] relative bg-white dark:bg-gray-800 -mx-6 px-6 scale-[1.02] z-10 border-2 border-primary/30 rounded-md"
              )}
              onClick={() => !isCreating && setIsCreating(true)}
            >
              {isCreating ? (
                <>
                  <TableCell>
                    <input
                      type="date"
                      name="transacted_at"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full p-1 border rounded"
                      form="create-transaction-form"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      name="plaid_name"
                      className="w-full p-1 border rounded"
                      form="create-transaction-form"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      name="merchant_name"
                      className="w-full p-1 border rounded"
                      form="create-transaction-form"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      name="category"
                      className="w-full p-1 border rounded"
                      form="create-transaction-form"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      name="source"
                      className="w-full p-1 border rounded"
                      form="create-transaction-form"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      className="w-full p-1 border rounded text-right font-mono"
                      form="create-transaction-form"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button type="submit" form="create-transaction-form" className="p-1 text-green-600 hover:text-green-800">
                        <span className="text-lg font-semibold">✓</span>
                      </button>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        setIsCreating(false);
                      }} className="p-1 text-red-600 hover:text-red-800">
                        <span className="text-lg font-semibold">✕</span>
                      </button>
                    </div>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Click to add a new transaction...
                  </TableCell>
                </>
              )}
            </TableRow>

            {sortedTransactions.map((transaction) => (
              <>
                <TableRow
                  key={transaction.id}
                  className={cn(
                    editingId === transaction.id && "shadow-[0_0_15px_rgba(0,0,0,0.1)] relative bg-white dark:bg-gray-800 -mx-6 px-6 scale-[1.02] z-10 border-2 border-primary/30 rounded-md"
                  )}
                >
                  {editingId === transaction.id ? (
                    <>
                      <TableCell>
                        <input
                          type="date"
                          name="transacted_at"
                          defaultValue={transaction.transacted_at.split('T')[0]}
                          className="w-full p-1 border rounded"
                          form={`edit-form-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          name="plaid_name"
                          defaultValue={transaction.plaid_name}
                          className="w-full p-1 border rounded"
                          form={`edit-form-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          name="merchant_name"
                          defaultValue={transaction.merchant_name}
                          className="w-full p-1 border rounded"
                          form={`edit-form-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          name="category"
                          defaultValue={transaction.category}
                          className="w-full p-1 border rounded"
                          form={`edit-form-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          name="source"
                          defaultValue={transaction.source}
                          className="w-full p-1 border rounded"
                          form={`edit-form-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="number"
                          name="amount"
                          defaultValue={transaction.amount}
                          step="0.01"
                          className="w-full p-1 border rounded text-right font-mono"
                          form={`edit-form-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <input
                            type="hidden"
                            name="hidden"
                            value={tempHidden.toString()}
                            form={`edit-form-${transaction.id}`}
                            id={`hidden-input-${transaction.id}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setTempHidden(!tempHidden);
                              const input = document.getElementById(`hidden-input-${transaction.id}`) as HTMLInputElement;
                              input.value = (!tempHidden).toString();
                            }}
                            className="p-1"
                          >
                            {tempHidden ? (
                              <EyeOff className="h-4 w-4 text-gray-500 hover:text-gray-700 transition-colors" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                            )}
                          </button>

                          <input
                            type="hidden"
                            name="reviewed"
                            value={tempReviewed.toString()}
                            form={`edit-form-${transaction.id}`}
                            id={`reviewed-input-${transaction.id}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setTempReviewed(!tempReviewed);
                              const input = document.getElementById(`reviewed-input-${transaction.id}`) as HTMLInputElement;
                              input.value = (!tempReviewed).toString();
                            }}
                            className="p-1"
                          >
                            {tempReviewed ? (
                              <CheckCircle className="h-4 w-4 text-green-500 hover:text-green-600 transition-colors" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-500 hover:text-yellow-600 transition-colors" />
                            )}
                          </button>

                          <button type="submit" form={`edit-form-${transaction.id}`} className="p-1 text-green-600 hover:text-green-800">
                            <span className="text-lg font-semibold">✓</span>
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:text-red-800">
                            <span className="text-lg font-semibold">✕</span>
                          </button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{formatDate(transaction.transacted_at)}</TableCell>
                      <TableCell>{transaction.plaid_name}</TableCell>
                      <TableCell>{transaction.merchant_name}</TableCell>
                      <TableCell>{transaction.category || 'Uncategorized'}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger>
                                {getSourceIcon(transaction.source)}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{transaction.source} transaction</p>
                              </TooltipContent>
                            </Tooltip>
                            <span>{transaction.source}</span>
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
                              <TooltipTrigger>
                                {transaction.hidden ? (
                                  <EyeOff className="h-4 w-4 text-gray-500 hover:text-gray-700 transition-colors" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{transaction.hidden ? 'Hidden Transaction' : 'Visible Transaction'}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger>
                                {transaction.reviewed ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 hover:text-green-600 transition-colors" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500 hover:text-yellow-600 transition-colors" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{transaction.reviewed ? 'Reviewed' : 'Needs Review'}</p>
                              </TooltipContent>
                            </Tooltip>

                            <button onClick={() => setEditingId(transaction.id)} className="p-1">
                              <PencilIcon className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                            </button>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </>
                  )}
                </TableRow>

                {editingId === transaction.id && (
                  <form
                    id={`edit-form-${transaction.id}`}
                    className="hidden"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      try {
                        await api.updateTransaction(transaction.id, {
                          transacted_at: formData.get('transacted_at') as string,
                          plaid_name: formData.get('plaid_name') as string,
                          merchant_name: formData.get('merchant_name') as string,
                          category: formData.get('category') as string,
                          source: formData.get('source') as string,
                          amount: parseFloat(formData.get('amount') as string),
                          hidden: formData.get('hidden') === 'true',
                          reviewed: formData.get('reviewed') === 'true'
                        });
                        setEditingId(null);
                        onUpdate?.();
                      } catch (error) {
                        console.error('Failed to update transaction:', error);
                      }
                    }}
                  />
                )}
              </>
            ))}

            {isCreating && (
              <form
                id="create-transaction-form"
                className="hidden"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
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
                    onUpdate?.();
                  } catch (error) {
                    console.error('Failed to create transaction:', error);
                  }
                }}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        {isCreating && (
          <Card className="p-4 mb-4 border-2 border-primary/30">
            {/* Add mobile create form here similar to edit form above */}
          </Card>
        )}
        {sortedTransactions.map((transaction) => (
          <div key={transaction.id}>
            {renderMobileTransaction(transaction)}
            {/* Keep the hidden forms */}
            {editingId === transaction.id && (
              <form
                id={`edit-form-${transaction.id}`}
                className="hidden"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  try {
                    await api.updateTransaction(transaction.id, {
                      transacted_at: formData.get('transacted_at') as string,
                      plaid_name: formData.get('plaid_name') as string,
                      merchant_name: formData.get('merchant_name') as string,
                      category: formData.get('category') as string,
                      source: formData.get('source') as string,
                      amount: parseFloat(formData.get('amount') as string),
                      hidden: formData.get('hidden') === 'true',
                      reviewed: formData.get('reviewed') === 'true'
                    });
                    setEditingId(null);
                    onUpdate?.();
                  } catch (error) {
                    console.error('Failed to update transaction:', error);
                  }
                }}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}