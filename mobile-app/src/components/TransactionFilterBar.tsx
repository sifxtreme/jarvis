import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../lib/theme';
import { getMonthName } from '../lib/utils';
import type { TransactionFilters } from '../lib/api';

interface Props {
  filters: TransactionFilters;
  onFilterChange: (filters: Partial<TransactionFilters>) => void;
  onOpenFilters: () => void;
}

export default function TransactionFilterBar({ filters, onFilterChange, onOpenFilters }: Props) {
  const colors = useColors();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const handlePrevMonth = () => {
    const m = filters.month ?? currentMonth;
    if (m === 1) {
      onFilterChange({ month: 12, year: (filters.year ?? currentYear) - 1 });
    } else {
      onFilterChange({ month: m - 1 });
    }
  };

  const handleNextMonth = () => {
    const m = filters.month ?? currentMonth;
    if (m === 12) {
      onFilterChange({ month: 1, year: (filters.year ?? currentYear) + 1 });
    } else {
      onFilterChange({ month: m + 1 });
    }
  };

  const monthLabel = filters.month ? `${getMonthName(filters.month)} ${filters.year ?? ''}` : 'All Time';

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
        <Ionicons name="chevron-back" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.monthButton}
        onPress={() => {
          if (filters.month) {
            onFilterChange({ month: undefined, year: undefined });
          } else {
            onFilterChange({ month: currentMonth, year: currentYear });
          }
        }}
      >
        <Text style={[styles.monthText, { color: colors.foreground }]}>{monthLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
        <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onOpenFilters} style={[styles.filterButton, { borderColor: colors.border }]}>
        <Ionicons name="options-outline" size={18} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navButton: {
    padding: 8,
  },
  monthButton: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterButton: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
});
