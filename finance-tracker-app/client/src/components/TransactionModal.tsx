import * as Dialog from '@radix-ui/react-dialog';
import { Transaction } from "../lib/api";
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState, useEffect, useRef } from 'react';
import { getBudgets } from '../lib/api';
import { FaCcAmex, FaCcVisa, FaUniversity, FaCreditCard } from 'react-icons/fa';
import { Wallet, Send, DollarSign } from 'lucide-react';

// CSS for diagonal stripes
const diagonalStripesStyle = `
  .bg-stripes {
    opacity: 0.3;
    background-image: repeating-linear-gradient(
      45deg,
      #888,
      #888 5px,
      transparent 5px,
      transparent 15px
    );
  }
`;

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
          console.error('Failed to fetch categories:', error);
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
      const filtered = categories.filter(category =>
        category.toLowerCase().includes(categoryInput.toLowerCase())
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
    setCategoryInput(category);
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
      if (categoryInputRef.current && !categoryInputRef.current.contains(e.target as Node)) {
        setShowCategorySuggestions(false);
      }

      if (sourceInputRef.current && !sourceInputRef.current.contains(e.target as Node)) {
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
      <style dangerouslySetInnerHTML={{ __html: diagonalStripesStyle }} />
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <Dialog.Title className="m-0 text-[17px] font-medium mb-4">
            {title}
          </Dialog.Title>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            // Override the category and source fields with our state values
            formData.set('category', categoryInput);
            formData.set('source', sourceInput);
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
                    className="w-full p-2 border rounded font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="amount" className="text-[15px]">Amount</label>
                  <input
                    id="amount"
                    type="number"
                    name="amount"
                    defaultValue={transaction?.amount}
                    step="0.01"
                    className="w-full p-2 border rounded text-right font-mono"
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
                      className="w-full p-2 border rounded bg-gray-200 text-gray-700 cursor-not-allowed"
                      disabled
                    />
                    <div className="absolute inset-0 bg-stripes rounded pointer-events-none"></div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="merchant_name" className="text-[15px]">Merchant</label>
                  <input
                    id="merchant_name"
                    type="text"
                    name="merchant_name"
                    defaultValue={transaction?.merchant_name}
                    className="w-full p-2 border rounded"
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
                    className="w-full p-2 border rounded"
                    autoComplete="off"
                  />
                  {showCategorySuggestions && filteredCategories.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border rounded shadow-lg z-10">
                      {filteredCategories.map((category, index) => (
                        <div
                          key={index}
                          className={`p-2 cursor-pointer ${selectedCategoryIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                          onClick={() => handleCategorySelect(category)}
                        >
                          {category}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 relative">
                  <label htmlFor="source" className="text-[15px]">Source</label>
                  <input
                    id="source"
                    type="text"
                    name="source"
                    value={sourceInput}
                    onChange={handleSourceChange}
                    onFocus={() => setShowSourceSuggestions(true)}
                    onKeyDown={handleSourceKeyDown}
                    ref={sourceInputRef}
                    className="w-full p-2 border rounded"
                    autoComplete="off"
                  />
                  {showSourceSuggestions && filteredSources.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border rounded shadow-lg z-10">
                      {filteredSources.map((source, index) => (
                        <div
                          key={index}
                          className={`p-2 flex items-center gap-2 cursor-pointer ${selectedSourceIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                          onClick={() => handleSourceSelect(source.name)}
                        >
                          {source.icon}
                          <span>{source.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status checkboxes - only show for editing, not for duplicating */}
              {transaction && !isDuplicating && (
                <div className="flex gap-4">
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
                className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Save
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute right-[10px] top-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none"
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