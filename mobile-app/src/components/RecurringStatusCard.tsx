import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { getRecurringStatus, type RecurringPattern, type CreateTransactionData } from '../lib/api';
import { useColors } from '../lib/theme';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function getStatusText(pattern: RecurringPattern): string {
  const diff = pattern.days_difference ?? 0;
  if (pattern.status === 'overdue') return `${Math.abs(diff)}d late`;
  if (pattern.status === 'due_soon') return `in ${diff}d`;
  return `in ${diff}d`;
}

interface Props {
  year: number;
  month: number;
  onQuickAdd: (prefill: Partial<CreateTransactionData>) => void;
}

export default function RecurringStatusCard({ year, month, onQuickAdd }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ['recurring-status', year, month],
    queryFn: () => getRecurringStatus({ year, month }),
  });

  const missing = data?.missing || [];

  // Sort: overdue first, then due_soon, then upcoming
  const sorted = useMemo(() => {
    const order = { overdue: 0, due_soon: 1, upcoming: 2 };
    return [...missing].sort((a, b) => {
      const aOrder = order[a.status || 'upcoming'] ?? 2;
      const bOrder = order[b.status || 'upcoming'] ?? 2;
      return aOrder - bOrder;
    });
  }, [missing]);

  const overdueCount = sorted.filter((p) => p.status === 'overdue').length;

  if (sorted.length === 0) return null;

  const handleQuickAdd = (pattern: RecurringPattern) => {
    const day = Math.min(pattern.typical_day, 28);
    const dateStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
    onQuickAdd({
      transacted_at: dateStr,
      plaid_name: pattern.plaid_name || pattern.display_name,
      merchant_name: pattern.merchant_name || pattern.display_name,
      amount: pattern.is_income ? -Math.abs(pattern.typical_amount) : Math.abs(pattern.typical_amount),
      source: pattern.source,
      category: pattern.category,
      hidden: false,
      reviewed: false,
    });
  };

  return (
    <View style={[styles.card, {
      backgroundColor: colors.card,
      borderColor: overdueCount > 0 ? colors.destructive : colors.warning,
    }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Ionicons
          name={overdueCount > 0 ? 'alert-circle' : 'time-outline'}
          size={18}
          color={overdueCount > 0 ? colors.destructive : colors.warning}
        />
        <Text style={[styles.headerText, { color: colors.foreground }]}>
          Missing Recurring ({sorted.length})
        </Text>
        {overdueCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
            <Text style={styles.badgeText}>{overdueCount} overdue</Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.mutedForeground}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.body, { borderTopColor: colors.border }]}>
          {sorted.map((pattern) => {
            const isOverdue = pattern.status === 'overdue';
            const isIncome = pattern.is_income;
            return (
              <View key={pattern.merchant_key} style={[styles.row, { borderBottomColor: colors.border }]}>
                <Ionicons
                  name={isOverdue ? 'alert-circle' : isIncome ? 'trending-up' : 'time-outline'}
                  size={16}
                  color={isOverdue ? colors.destructive : isIncome ? colors.success : colors.warning}
                  style={styles.rowIcon}
                />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowName, { color: isIncome ? colors.success : colors.foreground }]} numberOfLines={1}>
                    {pattern.display_name}
                  </Text>
                  <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>
                    {pattern.typical_day}{getOrdinalSuffix(pattern.typical_day)} · {formatCurrency(pattern.typical_amount)} · {pattern.source}
                  </Text>
                </View>
                <Text style={[styles.daysText, {
                  color: isOverdue ? colors.destructive : colors.mutedForeground,
                }]}>
                  {getStatusText(pattern)}
                </Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => handleQuickAdd(pattern)}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: 8, borderLeftWidth: 4, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  headerText: { fontSize: 14, fontWeight: '600', flex: 1 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  chevron: { marginLeft: 4 },
  body: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  rowIcon: { marginRight: 8 },
  rowContent: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '500' },
  rowDetail: { fontSize: 12, marginTop: 1 },
  daysText: { fontSize: 12, fontWeight: '500', marginRight: 8 },
  addBtn: { padding: 4 },
});
