import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Modal, StyleSheet, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../lib/theme';
import { getMonthName, YEARS } from '../lib/utils';
import type { TransactionFilters } from '../lib/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
}

export default function TransactionFilterSheet({ visible, onClose, filters: initialFilters, onApply }: Props) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);

  useEffect(() => {
    if (visible) setFilters(initialFilters);
  }, [visible, initialFilters]);

  const update = (partial: Partial<TransactionFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Filters</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Search */}
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Search..."
            placeholderTextColor={colors.mutedForeground}
            value={filters.query ?? ''}
            onChangeText={(query) => {
              if (query && filters.year !== undefined) {
                update({ query, year: undefined, month: undefined });
              } else {
                update({ query });
              }
            }}
          />

          {/* Year */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Year</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => update({ year: (filters.year ?? currentYear) - 1 })} style={[styles.chevron, { borderColor: colors.border }]}>
              <Ionicons name="chevron-back" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.yearLabel}
              onPress={() => update({ year: filters.year === undefined ? currentYear : undefined })}
            >
              <Text style={[styles.yearText, { color: colors.foreground }]}>{filters.year ?? 'All Years'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => update({ year: (filters.year ?? currentYear) + 1 })} style={[styles.chevron, { borderColor: colors.border }]}>
              <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Month */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Month</Text>
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => {
                const m = filters.month ?? currentMonth;
                if (m === 1) update({ month: 12, year: (filters.year ?? currentYear) - 1 });
                else update({ month: m - 1 });
              }}
              style={[styles.chevron, { borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.yearLabel}
              onPress={() => update({ month: filters.month === undefined ? currentMonth : undefined })}
            >
              <Text style={[styles.yearText, { color: colors.foreground }]}>
                {filters.month !== undefined ? getMonthName(filters.month) : 'All Months'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const m = filters.month ?? currentMonth;
                if (m === 12) update({ month: 1, year: (filters.year ?? currentYear) + 1 });
                else update({ month: m + 1 });
              }}
              style={[styles.chevron, { borderColor: colors.border }]}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Toggles */}
          <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Show Hidden</Text>
            <Switch value={filters.show_hidden} onValueChange={(v) => update({ show_hidden: v })} trackColor={{ true: colors.primary }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Needs Review</Text>
            <Switch value={filters.show_needs_review} onValueChange={(v) => update({ show_needs_review: v })} trackColor={{ true: colors.primary }} />
          </View>
        </View>

        <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.primary }]} onPress={() => onApply(filters)}>
          <Text style={[styles.applyText, { color: colors.primaryForeground }]}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { padding: 16, gap: 16 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { padding: 10, borderWidth: 1, borderRadius: 8 },
  yearLabel: { flex: 1, alignItems: 'center' },
  yearText: { fontSize: 16, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleLabel: { fontSize: 15 },
  applyButton: { margin: 16, borderRadius: 6, paddingVertical: 14, alignItems: 'center' },
  applyText: { fontSize: 16, fontWeight: '600' },
});
