import { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../lib/theme';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Transaction, Budget, TransactionFilters, CreateTransactionData } from '../lib/api';
import TransactionEditModal from './TransactionEditModal';

interface Props {
  transactions: Transaction[];
  isLoading: boolean;
  budgets: Budget[];
  onRefresh: () => void;
  filters: TransactionFilters;
  /** When set, opens create modal with pre-filled data */
  quickAddPrefill?: Partial<CreateTransactionData> | null;
  onClearQuickAdd?: () => void;
}

// Map well-known merchants to icons
function getMerchantIcon(merchant: string): string {
  const lower = (merchant || '').toLowerCase();
  if (lower.includes('amazon')) return 'logo-amazon';
  if (lower.includes('apple')) return 'logo-apple';
  if (lower.includes('google')) return 'logo-google';
  if (lower.includes('uber') || lower.includes('lyft')) return 'car-outline';
  if (lower.includes('netflix') || lower.includes('hulu') || lower.includes('disney')) return 'tv-outline';
  if (lower.includes('spotify')) return 'musical-notes-outline';
  if (lower.includes('starbucks') || lower.includes('coffee')) return 'cafe-outline';
  if (lower.includes('grocery') || lower.includes('whole food') || lower.includes('trader joe')) return 'cart-outline';
  if (lower.includes('gas') || lower.includes('shell') || lower.includes('chevron')) return 'speedometer-outline';
  if (lower.includes('gym') || lower.includes('fitness')) return 'barbell-outline';
  return 'receipt-outline';
}

function TransactionCard({ transaction, onPress, colors }: { transaction: Transaction; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  const isIncome = transaction.amount < 0;
  const displayAmount = Math.abs(transaction.amount);
  const amountColor = isIncome ? colors.success : colors.foreground;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, transaction.hidden && styles.hiddenCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
        <Ionicons name={getMerchantIcon(transaction.merchant_name) as any} size={20} color={colors.mutedForeground} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.merchantName, { color: colors.foreground }]} numberOfLines={1}>
          {transaction.merchant_name || transaction.plaid_name || 'Unknown'}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.category, { color: colors.mutedForeground }]} numberOfLines={1}>
            {transaction.category}
          </Text>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}> · </Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(transaction.transacted_at)}
          </Text>
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isIncome ? '+' : ''}{formatCurrency(displayAmount)}
        </Text>
        {!transaction.reviewed && (
          <View style={[styles.reviewDot, { backgroundColor: colors.warning }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TransactionList({ transactions, isLoading, budgets, onRefresh, filters, quickAddPrefill, onClearQuickAdd }: Props) {
  const colors = useColors();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const totalExpenses = useMemo(() => {
    return transactions.filter((t) => t.amount > 0 && !t.hidden).reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return transactions.filter((t) => t.amount < 0 && !t.hidden).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard transaction={item} onPress={() => setEditingTransaction(item)} colors={colors} />
    ),
    [colors]
  );

  const ListHeader = () => (
    <View style={[styles.summaryContainer, { borderBottomColor: colors.border }]}>
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Spent</Text>
        <Text style={[styles.summaryValue, { color: colors.destructive }]}>{formatCurrency(totalExpenses)}</Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Income</Text>
        <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totalIncome)}</Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Net</Text>
        <Text style={[styles.summaryValue, { color: totalIncome - totalExpenses >= 0 ? colors.success : colors.destructive }]}>
          {formatCurrency(totalIncome - totalExpenses)}
        </Text>
      </View>
    </View>
  );

  if (isLoading && transactions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions found</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />}
      />
      {/* Add Transaction FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      {/* Edit Modal */}
      {editingTransaction && (
        <TransactionEditModal
          transaction={editingTransaction}
          visible={!!editingTransaction}
          onClose={() => { setEditingTransaction(null); onRefresh(); }}
          budgets={budgets}
        />
      )}
      {/* Create Modal */}
      <TransactionEditModal
        transaction={null}
        visible={showCreateModal || !!quickAddPrefill}
        onClose={() => { setShowCreateModal(false); onClearQuickAdd?.(); onRefresh(); }}
        budgets={budgets}
        prefill={quickAddPrefill}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 100 },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  summaryDivider: { width: 1, marginVertical: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hiddenCard: { opacity: 0.5 },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: { flex: 1, marginRight: 12 },
  merchantName: { fontSize: 15, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  category: { fontSize: 13 },
  dot: { fontSize: 13 },
  date: { fontSize: 13 },
  amountContainer: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  reviewDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },
  fab: { position: 'absolute', right: 20, bottom: 90, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
});
