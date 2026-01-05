import { useQuery } from "@tanstack/react-query";
import { getTransactions, getBudgets, type TransactionFilters, type Transaction } from "../lib/api";
import TransactionTable from "../components/TransactionTable";
import TransactionStats from "../components/TransactionStats";
import { RecurringStatusCard } from "../components/RecurringStatusCard";
import { useEffect, useRef, useState } from "react";
import FilterControls from "@/components/FilterControls";
import SheetFilterControls from "@/components/SheetFilterControls";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilterIcon, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from 'react-router-dom'
import { StateCard } from "@/components/StateCard";

export default function TransactionsPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams()
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [quickAddTransaction, setQuickAddTransaction] = useState<Partial<Transaction> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(425);
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
    const params: Record<string, string> = {}

    if (filters.year !== undefined) {
      params.year = filters.year.toString()
    }
    if (filters.month !== undefined) {
      params.month = filters.month.toString()
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

  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
    retry: 2,
    retryDelay: 1000,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', filters],
    queryFn: () => getBudgets(filters),
  });

  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener("jarvis:transactions-changed", handleRefresh);
    return () => window.removeEventListener("jarvis:transactions-changed", handleRefresh);
  }, [refetch]);

  const handleSearch = (newFilters: Partial<TransactionFilters>) => {
    setFilters(current => ({
      ...current,
      ...newFilters
    }));
    setIsFilterOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex" ref={containerRef}>
        <div className="min-w-0 flex-1">
          <div className="h-full flex flex-col">
            <div className="p-4 flex-shrink-0">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-bold">Transactions</h1>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Desktop inline filters */}
                  <div className="hidden md:block">
                    <FilterControls
                      onSearch={handleSearch}
                      initialFilters={filters}
                      className="w-auto flex-shrink-0 bg-transparent shadow-none p-0"
                    />
                  </div>

                  {/* Mobile sheet filters */}
                  <div className="md:hidden flex items-center gap-2">
                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                          <FilterIcon className="h-4 w-4 mr-2" />
                          Filters
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                        <div className="h-full py-6">
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
            </div>

            <div className="flex-1 overflow-auto px-4 pb-4">
              {/* Recurring Status Card */}
              {filters.year && filters.month && (
                <RecurringStatusCard
                  year={filters.year}
                  month={filters.month}
                  onQuickAdd={(transaction) => setQuickAddTransaction(transaction)}
                />
              )}

              <TransactionTable
                transactions={transactions}
                isLoading={isLoading}
                onUpdate={() => refetch()}
                externalQuickAdd={quickAddTransaction}
                onExternalQuickAddHandled={() => setQuickAddTransaction(null)}
                budgetedCategories={new Set(budgets.map(b => b.name))}
              />

              {error && (
                <div className="mt-4">
                  <StateCard
                    title="Error loading transactions"
                    description={error instanceof Error ? error.message : "An error occurred while fetching transactions"}
                    variant="error"
                    actionLabel="Retry"
                    onAction={() => window.location.reload()}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {!!filters?.year && !!filters?.month && (
          <>
            <div
              className="relative hidden md:block w-2 bg-border hover:bg-primary/10 transition-colors cursor-col-resize"
              onPointerDown={(event) => {
                if (!isSidePanelOpen) return;
                resizingRef.current = { startX: event.clientX, startWidth: rightPanelWidth };
                const handleMove = (moveEvent: PointerEvent) => {
                  if (!resizingRef.current) return;
                  const delta = moveEvent.clientX - resizingRef.current.startX;
                  const next = resizingRef.current.startWidth - delta;
                  const containerWidth = containerRef.current?.clientWidth || 0;
                  const maxWidth = Math.max(320, containerWidth - 320);
                  setRightPanelWidth(Math.min(Math.max(200, next), maxWidth));
                };
                const handleUp = () => {
                  resizingRef.current = null;
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
              }}
            >
              <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-border/80" />
              <button
                type="button"
                onClick={() => setIsSidePanelOpen((current) => !current)}
                className="absolute left-1/2 top-1/2 flex h-10 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
                aria-label={isSidePanelOpen ? "Hide right panel" : "Show right panel"}
              >
                {isSidePanelOpen ? (
                  <PanelRightClose className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <div
              className={cn("hidden md:block h-full overflow-hidden", !isSidePanelOpen && "w-0")}
              style={{ width: isSidePanelOpen ? `${rightPanelWidth}px` : "0px" }}
            >
              {isSidePanelOpen && (
                <TransactionStats
                  transactions={transactions}
                  budgets={budgets}
                  isLoading={isLoading}
                  query={filters?.query}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
