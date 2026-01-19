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
  Scissors,
  Code
} from "lucide-react";
import { FaCcAmex, FaCcVisa, FaUniversity, FaCreditCard, FaAmazon, FaUber, FaSeedling, FaLeaf, FaSpotify, FaApple, FaAws, FaPlane } from 'react-icons/fa';
import { SiNetflix, SiTesla, SiOpenai } from 'react-icons/si';
import { TbTargetArrow } from 'react-icons/tb';
import { MdDeliveryDining } from 'react-icons/md';
import { GiPizzaSlice } from 'react-icons/gi';
import { HiShoppingCart } from 'react-icons/hi';
import { RiLeafLine } from 'react-icons/ri';
import { api, Transaction } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "./TransactionModal";
import { SplitTransactionModal } from "./SplitTransactionModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  onUpdate?: () => void;
  externalQuickAdd?: Partial<Transaction> | null;
  onExternalQuickAddHandled?: () => void;
  budgetedCategories?: Set<string>;
}

type SortField = 'transacted_at' | 'plaid_name' | 'merchant_name' | 'category' | 'amount' | 'source';
type SortDirection = 'asc' | 'desc';

interface InlineEditProps {
  value: string | number;
  onSave: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  prefix?: React.ReactNode;
}

const InlineEdit = ({ value, onSave, type = "text", className, prefix }: InlineEditProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (draft !== value.toString()) {
      onSave(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setDraft(value.toString());
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className={cn("relative flex items-center h-5", className)}>
        {prefix}
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          type={type}
          className="h-full w-full border-none bg-transparent p-0 text-inherit font-inherit focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none leading-none shadow-none min-w-[60px]"
        />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={cn(
        "cursor-text truncate hover:bg-black/5 hover:rounded px-0.5 -mx-0.5 transition-colors h-5 flex items-center",
        !value && "text-muted-foreground italic",
        className
      )}
    >
      {prefix}
      {type === "number" && !prefix ? formatCurrency(Number(value)) : (value || "Empty")}
    </div>
  );
};

const getSourceIcon = (source: string | null) => {
  if (!source) return null;

  switch (source.toLowerCase()) {
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

// Merchant icon detection
type MerchantIconInfo = {
  icon: React.ReactNode;
  label: string;
};

const getMerchantIcon = (plaidName: string | null, merchantName: string | null): MerchantIconInfo | null => {
  // Check merchantName first (it's the clean/normalized version), then plaidName
  const name = (merchantName || plaidName || '').toLowerCase();
  const plaidLower = (plaidName || '').toLowerCase();

  // Amazon / Prime Video / Kindle / AWS
  if (/\baws\b/i.test(name) || /amazon web services/i.test(plaidLower)) {
    return { icon: <FaAws className="h-4 w-4 text-[#FF9900]" />, label: 'AWS' };
  }
  if (/amazon|amzn|prime video|kindle/i.test(name)) {
    const label = name.includes('prime video') ? 'Prime Video' : name.includes('kindle') ? 'Kindle' : 'Amazon';
    return { icon: <FaAmazon className="h-4 w-4 text-[#FF9900]" />, label };
  }

  // Uber Eats (check before Uber)
  if (/uber eats/i.test(name) || (name.includes('uber') && plaidLower.includes('eats'))) {
    return { icon: <MdDeliveryDining className="h-4 w-4 text-[#06C167]" />, label: 'Uber Eats' };
  }

  // Uber
  if (/\buber\b/i.test(name)) {
    return { icon: <FaUber className="h-4 w-4 text-black" />, label: 'Uber' };
  }

  // Target
  if (/\btarget\b/i.test(name)) {
    return { icon: <TbTargetArrow className="h-4 w-4 text-[#CC0000]" />, label: 'Target' };
  }

  // Costco
  if (/costco/i.test(name)) {
    return { icon: <HiShoppingCart className="h-4 w-4 text-[#E31837]" />, label: 'Costco' };
  }

  // Sprouts
  if (/sprouts/i.test(name)) {
    return { icon: <FaSeedling className="h-4 w-4 text-green-600" />, label: 'Sprouts' };
  }

  // Trader Joe's
  if (/trader joe/i.test(name)) {
    return { icon: <RiLeafLine className="h-4 w-4 text-[#C8102E]" />, label: "Trader Joe's" };
  }

  // Whole Foods
  if (/whole foods/i.test(name)) {
    return { icon: <FaLeaf className="h-4 w-4 text-green-700" />, label: 'Whole Foods' };
  }

  // Netflix
  if (/netflix/i.test(name)) {
    return { icon: <SiNetflix className="h-4 w-4 text-[#E50914]" />, label: 'Netflix' };
  }

  // Spotify
  if (/spotify/i.test(name)) {
    return { icon: <FaSpotify className="h-4 w-4 text-[#1DB954]" />, label: 'Spotify' };
  }

  // Apple / iCloud
  if (/\bapple\b|icloud/i.test(name) || /apple\.com/i.test(plaidLower)) {
    return { icon: <FaApple className="h-4 w-4 text-gray-800" />, label: name.includes('icloud') ? 'iCloud' : 'Apple' };
  }

  // Tesla
  if (/tesla/i.test(name)) {
    return { icon: <SiTesla className="h-4 w-4 text-[#CC0000]" />, label: 'Tesla' };
  }

  // ChatGPT / OpenAI
  if (/chatgpt|openai/i.test(name)) {
    return { icon: <SiOpenai className="h-4 w-4 text-[#10A37F]" />, label: 'ChatGPT' };
  }

  // Domino's
  if (/domino/i.test(name)) {
    return { icon: <GiPizzaSlice className="h-4 w-4 text-[#006491]" />, label: "Domino's" };
  }

  // Southwest Airlines
  if (/southwest/i.test(name)) {
    return { icon: <FaPlane className="h-4 w-4 text-[#304CB2]" />, label: 'Southwest' };
  }

  // T-Mobile
  if (/t-mobile|tmobile/i.test(name)) {
    return { icon: <span className="h-4 w-4 text-[#E20074] font-bold text-xs">T</span>, label: 'T-Mobile' };
  }

  return null;
};


export default function TransactionTable({
  transactions = [],
  isLoading,
  onUpdate,
  externalQuickAdd,
  onExternalQuickAddHandled,
  budgetedCategories = new Set()
}: TransactionTableProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState<Transaction | null>(null);
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
  const [viewingRawTransaction, setViewingRawTransaction] = useState<Transaction | null>(null);
  const [isLoadingRawData, setIsLoadingRawData] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sortField, setSortField] = useState<SortField>('transacted_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Handle external quick add requests
  useEffect(() => {
    if (externalQuickAdd) {
      setDuplicatingTransaction(externalQuickAdd as Transaction);
      onExternalQuickAddHandled?.();
    }
  }, [externalQuickAdd, onExternalQuickAddHandled]);

  const handleViewRawData = async (transaction: Transaction) => {
    setIsLoadingRawData(true);
    setViewingRawTransaction(transaction); // Show modal immediately with basic info
    try {
      const fullTransaction = await api.getTransaction(transaction.id);
      setViewingRawTransaction(fullTransaction);
    } catch (error) {
      console.error('Failed to fetch transaction raw data:', error);
    } finally {
      setIsLoadingRawData(false);
    }
  };

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

  const handleQuickEdit = async (transaction: Transaction, field: keyof Transaction, value: string | number) => {
    try {
      await api.updateTransaction(transaction.id, {
        transacted_at: transaction.transacted_at,
        plaid_name: transaction.plaid_name || '',
        merchant_name: field === 'merchant_name' ? String(value) : (transaction.merchant_name || ''),
        category: field === 'category' ? String(value) : (transaction.category || ''),
        source: transaction.source || '',
        amount: field === 'amount' ? Number(value) : Number(transaction.amount),
        hidden: transaction.hidden,
        reviewed: transaction.reviewed
      });
      onUpdate?.();
    } catch (error) {
      console.error(`Failed to update transaction ${field}:`, error);
    }
  };

  const updateTransactionFlags = async (transaction: Transaction, updates: Partial<Pick<Transaction, "hidden" | "reviewed">>) => {
    try {
      setActionLoadingId(transaction.id);
      await api.updateTransaction(transaction.id, {
        transacted_at: transaction.transacted_at,
        plaid_name: transaction.plaid_name || '',
        merchant_name: transaction.merchant_name || '',
        category: transaction.category || '',
        source: transaction.source || '',
        amount: Number(transaction.amount),
        hidden: updates.hidden ?? transaction.hidden,
        reviewed: updates.reviewed ?? transaction.reviewed,
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update transaction flags:', error);
    } finally {
      setActionLoadingId(null);
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

      {/* Raw Data Modal */}
      <Dialog open={!!viewingRawTransaction} onOpenChange={() => setViewingRawTransaction(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-mono">
              Raw Data: {viewingRawTransaction?.merchant_name || viewingRawTransaction?.plaid_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {isLoadingRawData ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Loading...
              </div>
            ) : viewingRawTransaction?.raw_data ? (
              <pre className="font-mono text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(viewingRawTransaction.raw_data, null, 2)}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No raw data available for this transaction
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
                  "group transition-colors",
                  editingTransaction?.id === transaction.id
                    ? "bg-yellow-50 dark:bg-yellow-900/20"
                    : "hover:bg-muted/50"
                )}
              >
                <TableCell className="font-mono">{formatDate(transaction.transacted_at)}</TableCell>
                <TableCell className="font-mono">
                  <div className="flex items-center gap-1">
                    {(() => {
                      const merchantIcon = getMerchantIcon(transaction.plaid_name, transaction.merchant_name);
                      if (merchantIcon) {
                        return (
                          <div className="mr-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {merchantIcon.icon}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{merchantIcon.label}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <InlineEdit
                      value={transaction.merchant_name || ""}
                      onSave={(val) => handleQuickEdit(transaction, 'merchant_name', val)}
                    />
                  </div>
                </TableCell>
                <TableCell className={cn(
                  "font-mono",
                  transaction.category &&
                    !transaction.category.toLowerCase().includes('income') &&
                    budgetedCategories.size > 0 &&
                    !budgetedCategories.has(transaction.category) &&
                    "text-orange-600 font-medium"
                )}>
                  {transaction.category &&
                   !transaction.category.toLowerCase().includes('income') &&
                   budgetedCategories.size > 0 &&
                   !budgetedCategories.has(transaction.category) ? (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <InlineEdit
                        value={transaction.category}
                        onSave={(val) => handleQuickEdit(transaction, 'category', val)}
                      />
                    </div>
                  ) : (
                    <InlineEdit
                      value={transaction.category || ""}
                      onSave={(val) => handleQuickEdit(transaction, 'category', val)}
                      className={!transaction.category ? "text-muted-foreground italic" : ""}
                    />
                  )}
                </TableCell>
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
                  <div className="flex justify-end">
                    <InlineEdit
                      value={transaction.amount}
                      onSave={(val) => handleQuickEdit(transaction, 'amount', val)}
                      type="number"
                      prefix={transaction.amount < 0 ? "-" : "$"}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <div className="flex items-center space-x-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center justify-center w-6 h-6 rounded-md opacity-70 transition group-hover:opacity-100 hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTransactionFlags(transaction, { hidden: !transaction.hidden });
                            }}
                            disabled={actionLoadingId === transaction.id}
                            aria-label={transaction.hidden ? 'Unhide transaction' : 'Hide transaction'}
                          >
                          {transaction.hidden ? (
                            <EyeOff className="h-4 w-4 text-gray-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{transaction.hidden ? 'Hidden Transaction' : 'Visible Transaction'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center justify-center w-6 h-6 rounded-md opacity-70 transition group-hover:opacity-100 hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTransactionFlags(transaction, { reviewed: !transaction.reviewed });
                            }}
                            disabled={actionLoadingId === transaction.id}
                            aria-label={transaction.reviewed ? 'Mark as needs review' : 'Mark as reviewed'}
                          >
                          {transaction.reviewed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          )}
                          </button>
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

                      <Tooltip>
                        <TooltipTrigger
                          className="flex items-center justify-center w-6 h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRawData(transaction);
                          }}
                        >
                          <Code className="h-4 w-4 text-slate-500 hover:text-slate-700" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View Raw Data</p>
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
                    {(() => {
                      const merchantIcon = getMerchantIcon(transaction.plaid_name, transaction.merchant_name);
                      if (merchantIcon) {
                        return (
                          <div className="mr-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {merchantIcon.icon}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{merchantIcon.label}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <InlineEdit
                      value={transaction.merchant_name || ""}
                      onSave={(val) => handleQuickEdit(transaction, 'merchant_name', val)}
                    />
                  </div>
                </div>
                <div className="font-mono text-sm text-muted-foreground">{formatDate(transaction.transacted_at)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-medium flex justify-end">
                  <InlineEdit
                    value={transaction.amount}
                    onSave={(val) => handleQuickEdit(transaction, 'amount', val)}
                    type="number"
                    prefix={transaction.amount < 0 ? "-" : "$"}
                  />
                </div>
                <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground mt-2">
                  {getSourceIcon(transaction.source)}
                  <span className="font-mono">{transaction.source}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className={cn(
                "font-mono text-sm w-full mr-4",
                transaction.category &&
                  !transaction.category.toLowerCase().includes('income') &&
                  budgetedCategories.size > 0 &&
                  !budgetedCategories.has(transaction.category) &&
                  "text-orange-600 font-medium"
              )}>
                {transaction.category &&
                 !transaction.category.toLowerCase().includes('income') &&
                 budgetedCategories.size > 0 &&
                 !budgetedCategories.has(transaction.category) ? (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <InlineEdit
                      value={transaction.category}
                      onSave={(val) => handleQuickEdit(transaction, 'category', val)}
                    />
                  </div>
                ) : (
                  <InlineEdit
                    value={transaction.category || ""}
                    onSave={(val) => handleQuickEdit(transaction, 'category', val)}
                    className={!transaction.category ? "text-muted-foreground italic" : ""}
                  />
                )}
              </div>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewRawData(transaction);
                  }}
                  className="p-2 hover:bg-muted rounded-full flex items-center justify-center"
                >
                  <Code className="h-4 w-4 text-slate-500" />
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
