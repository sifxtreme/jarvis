import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getTransactions, getBudgets, type TransactionFilters, type CreateTransactionData } from '../../src/lib/api';
import { useColors } from '../../src/lib/theme';
import { EventEmitter } from '../../src/lib/events';
import TransactionList from '../../src/components/TransactionList';
import TransactionFilterBar from '../../src/components/TransactionFilterBar';
import TransactionFilterSheet from '../../src/components/TransactionFilterSheet';
import RecurringStatusCard from '../../src/components/RecurringStatusCard';

export default function TransactionsScreen() {
  const colors = useColors();
  const now = new Date();
  const [filters, setFilters] = useState<TransactionFilters>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    query: '',
    show_hidden: false,
    show_needs_review: false,
  });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState<Partial<CreateTransactionData> | null>(null);

  const { data: transactions = [], isLoading, refetch } = useQuery({
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
    return EventEmitter.on('transactions-changed', () => refetch());
  }, [refetch]);

  const handleFilterChange = useCallback((newFilters: Partial<TransactionFilters>) => {
    setFilters((current) => ({ ...current, ...newFilters }));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TransactionFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onOpenFilters={() => setFilterSheetVisible(true)}
      />
      {filters.year && filters.month && (
        <RecurringStatusCard
          year={filters.year}
          month={filters.month}
          onQuickAdd={(prefill) => setQuickAddPrefill(prefill)}
        />
      )}
      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        budgets={budgets}
        onRefresh={refetch}
        filters={filters}
        quickAddPrefill={quickAddPrefill}
        onClearQuickAdd={() => setQuickAddPrefill(null)}
      />
      <TransactionFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setFilterSheetVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
