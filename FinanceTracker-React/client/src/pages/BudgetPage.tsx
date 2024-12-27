import { useQuery } from "@tanstack/react-query";
import { getBudgets, getTransactions, type BudgetFilters, type TransactionFilters } from "../lib/api";
import BudgetComparison from "../components/BudgetComparison";
import { useState } from "react";
import FilterControls from "@/components/FilterControls";

export default function BudgetPage() {
  const [searchParams, setSearchParams] = useState<BudgetFilters & TransactionFilters>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    show_hidden: false,
    show_needs_review: false,
  });

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', searchParams],
    queryFn: () => getTransactions(searchParams),
    retry: 2,
    retryDelay: 1000,
  });

  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery({
    queryKey: ['budgets', searchParams],
    queryFn: () => getBudgets(searchParams),
    retry: 2,
    retryDelay: 1000,
  });

  const handleSearch = (newFilters: TransactionFilters) => {
    setSearchParams(newFilters);
  };

  const isLoading = isLoadingTransactions || isLoadingBudgets;

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Budget Overview</h1>
            <FilterControls 
              onSearch={handleSearch} 
              initialFilters={searchParams}
              className="w-auto flex-shrink-0 bg-transparent shadow-none p-0"
            />
          </div>

          <BudgetComparison 
            transactions={transactions} 
            budgets={budgets}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
