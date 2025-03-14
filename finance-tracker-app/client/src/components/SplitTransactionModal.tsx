import * as Dialog from '@radix-ui/react-dialog';
import { Transaction } from "../lib/api";
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState, useEffect } from 'react';
import { formatCurrency } from '../lib/utils';
import { Trash2, Plus } from 'lucide-react';

interface SplitTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (originalTransaction: Transaction, splitTransactions: Omit<Transaction, 'id'>[]) => Promise<void>;
  transaction: Transaction | null;
}

export function SplitTransactionModal({
  open,
  onClose,
  onSubmit,
  transaction
}: SplitTransactionModalProps) {
  const [splits, setSplits] = useState<{
    merchant_name: string;
    category: string;
    amount: number;
  }[]>([]);
  const [remainingAmount, setRemainingAmount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Reset the form when the transaction changes
  useEffect(() => {
    if (transaction) {
      // Initialize with one split transaction
      setSplits([
        {
          merchant_name: transaction.merchant_name,
          category: transaction.category,
          amount: transaction.amount / 2, // Default to half the amount
        }
      ]);
      setRemainingAmount(transaction.amount / 2);
    } else {
      setSplits([]);
      setRemainingAmount(0);
    }
  }, [transaction]);

  const handleAddSplit = () => {
    if (remainingAmount <= 0) {
      setErrorMessage('No remaining amount to split');
      return;
    }

    setSplits([
      ...splits,
      {
        merchant_name: transaction?.merchant_name || '',
        category: transaction?.category || '',
        amount: 0,
      }
    ]);
  };

  const handleRemoveSplit = (index: number) => {
    const newSplits = [...splits];
    const removedAmount = newSplits[index].amount;
    newSplits.splice(index, 1);
    setSplits(newSplits);

    // Update remaining amount
    setRemainingAmount(remainingAmount + removedAmount);
  };

  const handleSplitChange = (index: number, field: string, value: string | number) => {
    const newSplits = [...splits];

    if (field === 'amount') {
      const oldAmount = newSplits[index].amount;
      const newAmount = typeof value === 'string' ? parseFloat(value) || 0 : value;

      // Calculate new remaining amount
      const newRemainingAmount = remainingAmount + (oldAmount - newAmount);

      // Check if the new amount would make the remaining amount negative
      if (newRemainingAmount < 0) {
        setErrorMessage('Total split amount cannot exceed the original transaction amount');
        return;
      }

      setRemainingAmount(newRemainingAmount);
      newSplits[index].amount = newAmount;
    } else {
      // @ts-ignore - we know the field exists
      newSplits[index][field] = value;
    }

    setSplits(newSplits);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction) return;

    // Validate that all splits have an amount greater than 0
    if (splits.some(split => split.amount <= 0)) {
      setErrorMessage('All splits must have an amount greater than 0');
      return;
    }

    // Create the split transactions
    const splitTransactions = splits.map(split => ({
      ...transaction,
      merchant_name: split.merchant_name,
      category: split.category,
      amount: split.amount,
    }));

    // If there's remaining amount, add it to the original transaction
    const originalTransaction = {
      ...transaction,
      amount: remainingAmount,
    };

    try {
      await onSubmit(originalTransaction, splitTransactions);
      onClose();
    } catch (error) {
      console.error('Failed to split transaction:', error);
      setErrorMessage('Failed to split transaction');
    }
  };

  if (!transaction) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[600px] max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-md shadow-lg p-6 data-[state=open]:animate-contentShow">
          <Dialog.Title className="text-xl font-semibold mb-4">Split Transaction</Dialog.Title>

          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <h3 className="font-semibold mb-2">Original Transaction</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Merchant</p>
                <p>{transaction.merchant_name || transaction.plaid_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                <p className="font-mono">{formatCurrency(transaction.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
                <p>{transaction.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Source</p>
                <p>{transaction.source}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Splits</h3>
                <button
                  type="button"
                  onClick={handleAddSplit}
                  className="flex items-center gap-1 text-sm bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                >
                  <Plus className="h-4 w-4" />
                  Add Split
                </button>
              </div>

              {splits.map((split, index) => (
                <div key={index} className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Split #{index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={splits.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Merchant Name</label>
                      <input
                        type="text"
                        value={split.merchant_name}
                        onChange={(e) => handleSplitChange(index, 'merchant_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <input
                        type="text"
                        value={split.category}
                        onChange={(e) => handleSplitChange(index, 'category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Remaining Amount</h3>
                <p className={`font-mono font-semibold ${remainingAmount < 0 ? 'text-red-500' : ''}`}>
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This amount will remain on the original transaction
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Split
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full w-8 h-8 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
              aria-label="Close"
            >
              <Cross2Icon />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}