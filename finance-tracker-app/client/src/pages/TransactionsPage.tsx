import { useQuery } from "@tanstack/react-query";
import { getTransactions, getBudgets, type TransactionFilters } from "../lib/api";
import TransactionTable from "../components/TransactionTable";
import TransactionStats from "../components/TransactionStats";
import { useState, useEffect } from "react";
import {
  Panel as ResizablePanel,
  PanelGroup as ResizablePanelGroup,
  PanelResizeHandle as ResizeHandle,
} from "react-resizable-panels";
import FilterControls from "@/components/FilterControls";
import SheetFilterControls from "@/components/SheetFilterControls";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilterIcon } from "lucide-react";
import { useSearchParams } from 'react-router-dom'
import { startOfMonth, endOfMonth } from 'date-fns'

export default function TransactionsPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize filters from URL or defaults
  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const now = new Date();
    return {
      year: parseInt(searchParams.get('year') || now.getFullYear().toString()),
      month: parseInt(searchParams.get('month') || (now.getMonth() + 1).toString()),
      query: searchParams.get('query') || '',
      show_hidden: searchParams.get('show_hidden') === 'true',
      show_needs_review: searchParams.get('show_needs_review') === 'true'
    }
  })

  // Update URL when filters change
  useEffect(() => {
    const params: Record<string, string> = {
      year: filters.year.toString(),
      month: filters.month.toString()
    }

    if (filters.query) {
      params.query = filters.query
    }
    if (filters.show_hidden) {
      params.show_hidden = 'true'
    }
    if (filters.show_needs_review) {
      params.show_needs_review = 'true'
    }

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
    retry: 2,
    retryDelay: 1000,
  });

  const { data: budgets = [], refetch: refetchBudgets } = useQuery({
    queryKey: ['budgets', filters],
    queryFn: () => getBudgets(filters),
  });

  const handleSearch = (newFilters: Partial<TransactionFilters>) => {
    setFilters(current => ({
      ...current,
      ...newFilters
    }));
    setIsFilterOpen(false);
  };

  return (
    <div className="h-screen flex flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="h-full flex flex-col">
            <div className="p-4 flex-shrink-0">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Finances</h1>

                {/* Desktop inline filters */}
                <div className="hidden md:block">
                  <FilterControls
                    onSearch={handleSearch}
                    initialFilters={filters}
                    className="w-auto flex-shrink-0 bg-transparent shadow-none p-0"
                  />
                </div>

                {/* Mobile sheet filters */}
                <div className="md:hidden">
                  <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FilterIcon className="h-4 w-4 mr-2" />
                        Filters
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                      <div className="h-full py-6">
                        <h3 className="text-lg font-semibold mb-4">Filter Transactions</h3>
                        <SheetFilterControls
                          onSearch={handleSearch}
                          initialFilters={filters}
                          className="w-full bg-transparent shadow-none"
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 pb-4">
              <TransactionTable
                transactions={transactions}
                isLoading={isLoading}
                onUpdate={() => refetch()}
              />

              {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-md flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Error Loading Transactions</h4>
                    <p className="text-sm">
                      {error instanceof Error ? error.message : "An error occurred while fetching transactions"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizeHandle className="bg-border w-2 hover:bg-primary/10 transition-colors" />

        <ResizablePanel defaultSize={30} minSize={20} className="hidden md:block">
          <TransactionStats
            transactions={transactions}
            budgets={budgets}
            isLoading={isLoading}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}