import * as Dialog from '@radix-ui/react-dialog';
import { Transaction } from "../lib/api";
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState, useEffect, useRef } from 'react';
import { getBudgets } from '../lib/api';
import { logger } from '../lib/logger';
import { FaCcAmex, FaCcVisa, FaUniversity, FaCreditCard } from 'react-icons/fa';
import { Wallet, Send, DollarSign } from 'lucide-react';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  transaction?: Transaction;
  title: string;
  isDuplicating?: boolean;
}

// Hardcoded list of sources with their icons
const SOURCES = [
  { name: 'amex', icon: <FaCcAmex className="h-5 w-5 text-blue-600 transform scale-90 antialiased" /> },
  { name: 'hafsa_chase', icon: <FaCcVisa className="h-5 w-5 text-blue-500 transform scale-90 antialiased" /> },
  { name: 'asif_chase', icon: <FaCcVisa className="h-5 w-5 text-blue-500 transform scale-90 antialiased" /> },
  { name: 'asif_citi', icon: <FaCreditCard className="h-5 w-5 text-purple-500 transform scale-90 antialiased" /> },
  { name: 'cash', icon: <Wallet className="h-5 w-5 text-green-500 transform scale-90 antialiased" /> },
  { name: 'bofa', icon: <FaUniversity className="h-5 w-5 text-red-600 transform scale-90 antialiased" /> },
  { name: 'zelle', icon: <Send className="h-5 w-5 text-purple-600 transform scale-90 antialiased" /> },
  { name: 'venmo', icon: <DollarSign className="h-5 w-5 text-blue-400 transform scale-90 antialiased" /> },
];

export function TransactionModal({
  open,
  onClose,
  onSubmit,
  transaction,
  title,
  isDuplicating = false
}: TransactionModalProps) {
  // Get today's date in YYYY-MM-DD format for the date input
  const today = new Date().toISOString().split('T')[0];

  // State for category suggestions
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState(transaction?.category || '');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(-1);

  // State for source suggestions
  const [filteredSources, setFilteredSources] = useState(SOURCES);
  const [sourceInput, setSourceInput] = useState(transaction?.source || '');
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(-1);

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState({
    amount: false,
    merchant_name: false,
    source: false
  });

  // Fetch budget categories when the modal opens
  useEffect(() => {
    if (open) {
      const fetchCategories = async () => {
        try {
          const currentDate = new Date();
          const budgets = await getBudgets({
            year: currentDate.getFullYear(),
            month: currentDate.getMonth() + 1,
            show_hidden: false,
            show_needs_review: false
          });

          // Extract unique category names from budgets
          const categoryNames = budgets.map(budget => budget.name);
          setCategories(categoryNames);
        } catch (error) {
          logger.error('Transaction', 'Failed to fetch categories:', error);
        }
      };

      fetchCategories();

      // Initialize category input if transaction exists
      if (transaction?.category) {
        setCategoryInput(transaction.category);
      }

      // Initialize source input if transaction exists
      if (transaction?.source) {
        setSourceInput(transaction.source);
      }
    }
  }, [open, transaction]);

  // Filter categories based on input
  useEffect(() => {
    if (categoryInput) {
      const searchTerm = categoryInput.toLowerCase().trim();
      const filtered = categories.filter(category =>
        category.toLowerCase().includes(searchTerm)
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
    // Reset selected index when filtered list changes
    setSelectedCategoryIndex(-1);
  }, [categoryInput, categories]);

  // Filter sources based on input
  useEffect(() => {
    if (sourceInput) {
      const filtered = SOURCES.filter(source =>
        source.name.toLowerCase().includes(sourceInput.toLowerCase())
      );
      setFilteredSources(filtered);
    } else {
      setFilteredSources(SOURCES);
    }
    // Reset selected index when filtered list changes
    setSelectedSourceIndex(-1);
  }, [sourceInput]);

  // Handle category input change
  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't trim here to allow typing spaces, but we'll trim on selection and submission
    setCategoryInput(e.target.value);
    setShowCategorySuggestions(true);
  };

  // Handle source input change
  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSourceInput(e.target.value);
    setShowSourceSuggestions(true);
  };

  // Handle category suggestion selection
  const handleCategorySelect = (category: string) => {
    // Ensure the category is properly trimmed and set
    setCategoryInput(category.trim());
    setShowCategorySuggestions(false);
    setSelectedCategoryIndex(-1);

    // Focus back on the input after selection
    if (categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  };

  // Handle source suggestion selection
  const handleSourceSelect = (source: string) => {
    setSourceInput(source);
    setShowSourceSuggestions(false);
    setSelectedSourceIndex(-1);

    // Focus back on the input after selection
    if (sourceInputRef.current) {
      sourceInputRef.current.focus();
    }
  };

  // Handle keyboard navigation for category suggestions
  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCategorySuggestions || filteredCategories.length === 0) return;

    // Arrow down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCategoryIndex(prev =>
        prev < filteredCategories.length - 1 ? prev + 1 : prev
      );
    }
    // Arrow up
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCategoryIndex(prev => (prev > 0 ? prev - 1 : 0));
    }
    // Enter
    else if (e.key === 'Enter' && selectedCategoryIndex >= 0) {
      e.preventDefault();
      handleCategorySelect(filteredCategories[selectedCategoryIndex]);
    }
    // Escape
    else if (e.key === 'Escape') {
      setShowCategorySuggestions(false);
      setSelectedCategoryIndex(-1);
    }
  };

  // Handle keyboard navigation for source suggestions
  const handleSourceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSourceSuggestions || filteredSources.length === 0) return;

    // Arrow down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSourceIndex(prev =>
        prev < filteredSources.length - 1 ? prev + 1 : prev
      );
    }
    // Arrow up
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSourceIndex(prev => (prev > 0 ? prev - 1 : 0));
    }
    // Enter
    else if (e.key === 'Enter' && selectedSourceIndex >= 0) {
      e.preventDefault();
      handleSourceSelect(filteredSources[selectedSourceIndex].name);
    }
    // Escape
    else if (e.key === 'Escape') {
      setShowSourceSuggestions(false);
      setSelectedSourceIndex(-1);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close the dropdown if we're clicking inside it
      const target = e.target as Node;

      // For category dropdown
      const categoryDropdown = document.querySelector('.category-dropdown');
      const isClickInCategoryInput = categoryInputRef.current?.contains(target);
      const isClickInCategoryDropdown = categoryDropdown?.contains(target);

      if (!isClickInCategoryInput && !isClickInCategoryDropdown) {
        setShowCategorySuggestions(false);
      }

      // For source dropdown
      const sourceDropdown = document.querySelector('.source-dropdown');
      const isClickInSourceInput = sourceInputRef.current?.contains(target);
      const isClickInSourceDropdown = sourceDropdown?.contains(target);

      if (!isClickInSourceInput && !isClickInSourceDropdown) {
        setShowSourceSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-background text-foreground p-[25px] overflow-y-auto shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <Dialog.Title className="m-0 text-[17px] font-medium mb-4">
            {title}
          </Dialog.Title>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);

            // Validate required fields
            const amount = formData.get('amount') as string;
            const merchant_name = formData.get('merchant_name') as string;

            // Reset validation errors
            const errors = {
              amount: !amount,
              merchant_name: !merchant_name,
              source: !sourceInput
            };

            setValidationErrors(errors);

            // If any required field is empty, prevent form submission
            if (errors.amount || errors.merchant_name || errors.source) {
              return;
            }

            // Override the category and source fields with our state values
            formData.set('category', categoryInput.trim());
            formData.set('source', sourceInput.trim());
            // Ensure plaid_name is included even though the field is disabled
            if (transaction?.plaid_name) {
              formData.set('plaid_name', transaction.plaid_name);
            } else {
              // For new transactions, set an empty string for plaid_name
              formData.set('plaid_name', '');
            }
            await onSubmit(formData);
          }}>
            <div className="grid gap-4">
              {/* First row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="transacted_at" className="text-[15px]">Date</label>
                  <input
                    id="transacted_at"
                    type="date"
                    name="transacted_at"
                    defaultValue={isDuplicating ? today : (transaction?.transacted_at.split('T')[0] || today)}
                    className="w-full p-2 border rounded font-mono bg-background text-foreground dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="amount" className="text-[15px] flex items-center">
                    Amount
                  </label>
                  <input
                    id="amount"
                    type="number"
                    name="amount"
                    defaultValue={transaction?.amount}
                    step="0.01"
                    className={`w-full p-2 border rounded text-right font-mono bg-background text-foreground dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 ${validationErrors.amount ? 'border-red-500 outline-red-500' : ''}`}
                    onChange={() => setValidationErrors(prev => ({ ...prev, amount: false }))}
                  />
                </div>
              </div>

              {/* Second row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="plaid_name" className="text-[15px]">Vendor</label>
                  <div className="relative">
                    <input
                      id="plaid_name"
                      type="text"
                      name="plaid_name"
                      defaultValue={transaction?.plaid_name}
                      className="w-full p-2 border rounded bg-muted text-muted-foreground cursor-not-allowed dark:bg-slate-900/60 dark:border-slate-700 dark:text-slate-400"
                      disabled
                    />
                    <div className="absolute inset-0 bg-stripes rounded pointer-events-none"></div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="merchant_name" className="text-[15px] flex items-center">
                    Merchant
                  </label>
                  <input
                    id="merchant_name"
                    type="text"
                    name="merchant_name"
                    defaultValue={transaction?.merchant_name}
                    className={`w-full p-2 border rounded bg-background text-foreground dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 ${validationErrors.merchant_name ? 'border-red-500 outline-red-500' : ''}`}
                    onChange={() => setValidationErrors(prev => ({ ...prev, merchant_name: false }))}
                  />
                </div>
              </div>

              {/* Third row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2 relative">
                  <label htmlFor="category" className="text-[15px]">Category</label>
                  <input
                    id="category"
                    type="text"
                    name="category"
                    value={categoryInput}
                    onChange={handleCategoryChange}
                    onFocus={() => setShowCategorySuggestions(true)}
                    onKeyDown={handleCategoryKeyDown}
                    ref={categoryInputRef}
                    className="w-full p-2 border rounded bg-background text-foreground dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                    autoComplete="off"
                  />
                  {showCategorySuggestions && filteredCategories.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-popover border rounded shadow-lg z-10 category-dropdown dark:bg-slate-950 dark:border-slate-700">
                      {filteredCategories.map((category, index) => (
                        <button
                          key={index}
                          type="button"
                          className={`w-full text-left p-3 cursor-pointer border-b border-border last:border-b-0 ${selectedCategoryIndex === index
                            ? 'bg-accent font-medium'
                            : 'hover:bg-muted'
                            }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCategorySelect(category);
                          }}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 relative">
                  <label htmlFor="source" className="text-[15px] flex items-center">
                    Source
                  </label>
                  <input
                    id="source"
                    type="text"
                    name="source"
                    value={sourceInput}
                    onChange={(e) => {
                      handleSourceChange(e);
                      setValidationErrors(prev => ({ ...prev, source: false }));
                    }}
                    onFocus={() => setShowSourceSuggestions(true)}
                    onKeyDown={handleSourceKeyDown}
                    ref={sourceInputRef}
                    className={`w-full p-2 border rounded bg-background text-foreground dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 ${validationErrors.source ? 'border-red-500 outline-red-500' : ''}`}
                    autoComplete="off"
                  />
                  {showSourceSuggestions && filteredSources.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-popover border rounded shadow-lg z-10 source-dropdown dark:bg-slate-950 dark:border-slate-700">
                      {filteredSources.map((source, index) => (
                        <button
                          key={index}
                          type="button"
                          className={`w-full text-left p-3 cursor-pointer border-b border-border last:border-b-0 ${selectedSourceIndex === index
                            ? 'bg-accent font-medium'
                            : 'hover:bg-muted'
                            }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSourceSelect(source.name);
                          }}
                        >
                          <div className="flex items-center">
                            {source.icon}
                            <span className="ml-2">{source.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status checkboxes - only show for editing, not for duplicating */}
              {transaction && !isDuplicating && (
                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hidden"
                      name="hidden"
                      defaultChecked={transaction.hidden}
                      className="w-4 h-4"
                    />
                    <label htmlFor="hidden" className="text-[15px]">Hidden</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="reviewed"
                      name="reviewed"
                      defaultChecked={transaction.reviewed}
                      className="w-4 h-4"
                    />
                    <label htmlFor="reviewed" className="text-[15px]">Reviewed</label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border bg-background text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Save
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute right-[10px] top-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none"
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
