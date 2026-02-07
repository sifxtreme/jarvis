import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { getTransactions, getBudgets, type Transaction, type Budget } from '../../src/lib/api';
import { useColors } from '../../src/lib/theme';
import { formatCurrency, getMonthName } from '../../src/lib/utils';

interface CategoryRow {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  isIncome: boolean;
}

export default function BudgetScreen() {
  const colors = useColors();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: transactions = [], isLoading: transLoading } = useQuery({
    queryKey: ['transactions', { year: selectedYear, month: selectedMonth }],
    queryFn: () => getTransactions({ year: selectedYear, month: selectedMonth }),
  });

  const { data: budgets = [], isLoading: budgetLoading } = useQuery({
    queryKey: ['budgets', { year: selectedYear, month: selectedMonth }],
    queryFn: () => getBudgets({ year: selectedYear, month: selectedMonth }),
  });

  const isLoading = transLoading || budgetLoading;

  const rows = useMemo(() => {
    const budgetMap = new Map<string, Budget>();
    budgets.forEach((b) => budgetMap.set(b.name, b));

    const actualByCategory = new Map<string, number>();
    transactions.filter((t) => !t.hidden).forEach((t) => {
      const cat = t.category || 'Other';
      actualByCategory.set(cat, (actualByCategory.get(cat) || 0) + t.amount);
    });

    const allCategories = new Set([...budgetMap.keys(), ...actualByCategory.keys()]);
    const result: CategoryRow[] = [];

    allCategories.forEach((cat) => {
      const budget = budgetMap.get(cat);
      const actual = actualByCategory.get(cat) || 0;
      const budgetAmount = budget?.amount || 0;
      result.push({
        category: cat,
        budget: budgetAmount,
        actual: Math.abs(actual),
        variance: budgetAmount - Math.abs(actual),
        isIncome: budget?.expense_type === 'income' || actual < 0,
      });
    });

    // Sort: income first, then by budget desc
    return result.sort((a, b) => {
      if (a.isIncome && !b.isIncome) return -1;
      if (!a.isIncome && b.isIncome) return 1;
      return b.budget - a.budget;
    });
  }, [transactions, budgets]);

  const totalBudgeted = rows.filter((r) => !r.isIncome).reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.filter((r) => !r.isIncome).reduce((s, r) => s + r.actual, 0);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const renderCategoryRow = ({ item }: { item: CategoryRow }) => {
    const pct = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;
    const isOver = item.actual > item.budget && item.budget > 0;
    const barColor = item.isIncome ? colors.success : isOver ? colors.destructive : colors.primary;
    const barWidth = item.budget > 0 ? Math.min(pct, 100) : 0;

    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={styles.rowHeader}>
          <Text style={[styles.categoryName, { color: colors.foreground }]} numberOfLines={1}>{item.category}</Text>
          <View style={styles.rowAmounts}>
            <Text style={[styles.actual, { color: isOver ? colors.destructive : colors.foreground }]}>
              {formatCurrency(item.actual)}
            </Text>
            {item.budget > 0 && (
              <Text style={[styles.budgetAmount, { color: colors.mutedForeground }]}>
                / {formatCurrency(item.budget)}
              </Text>
            )}
          </View>
        </View>
        {item.budget > 0 && (
          <View style={[styles.barBg, { backgroundColor: colors.secondary }]}>
            <View style={[styles.barFill, { backgroundColor: barColor, width: `${barWidth}%` }]} />
          </View>
        )}
        {item.budget > 0 && (
          <Text style={[styles.varianceText, { color: item.variance >= 0 ? colors.success : colors.destructive }]}>
            {item.variance >= 0 ? `${formatCurrency(item.variance)} left` : `${formatCurrency(Math.abs(item.variance))} over`}
          </Text>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {/* Month Navigation */}
      <View style={[styles.monthNav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setSelectedMonth(currentMonth); setSelectedYear(currentYear); }}
          style={styles.monthCenter}
        >
          <Text style={[styles.monthText, { color: colors.foreground }]}>
            {getMonthName(selectedMonth)} {selectedYear}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={[styles.summary, { backgroundColor: colors.secondary }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Budgeted</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatCurrency(totalBudgeted)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Spent</Text>
          <Text style={[styles.summaryValue, { color: totalActual > totalBudgeted ? colors.destructive : colors.foreground }]}>
            {formatCurrency(totalActual)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowLast]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Remaining</Text>
          <Text style={[styles.summaryValue, { color: totalBudgeted - totalActual >= 0 ? colors.success : colors.destructive, fontWeight: '700' }]}>
            {formatCurrency(totalBudgeted - totalActual)}
          </Text>
        </View>
      </View>

      {/* Section Header */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Categories</Text>
    </>
  );

  if (isLoading && rows.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.category}
        renderItem={renderCategoryRow}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  navBtn: { padding: 8 },
  monthCenter: { flex: 1, alignItems: 'center' },
  monthText: { fontSize: 17, fontWeight: '700' },
  summary: { margin: 16, borderRadius: 8, padding: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryRowLast: { paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  listContent: { paddingBottom: 100 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 6 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 8 },
  rowAmounts: { flexDirection: 'row', alignItems: 'baseline' },
  actual: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  budgetAmount: { fontSize: 13, marginLeft: 4 },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  varianceText: { fontSize: 12, fontWeight: '500' },
});
