import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { getTrends, getMerchantTrends, type TrendsData, type MerchantTrendsData } from '../../src/lib/api';
import { useColors } from '../../src/lib/theme';
import { formatCurrency, getShortMonthName, YEARS } from '../../src/lib/utils';

// Simple bar chart component
function BarChart({ data, colors, maxValue }: {
  data: { label: string; value: number; color?: string }[];
  colors: ReturnType<typeof useColors>;
  maxValue: number;
}) {
  return (
    <View style={barStyles.container}>
      {data.map((item, i) => (
        <View key={i} style={barStyles.barRow}>
          <Text style={[barStyles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.label}
          </Text>
          <View style={[barStyles.barBg, { backgroundColor: colors.secondary }]}>
            <View
              style={[barStyles.barFill, {
                backgroundColor: item.color || colors.primary,
                width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0%',
              }]}
            />
          </View>
          <Text style={[barStyles.value, { color: colors.foreground }]}>
            {formatCurrency(item.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 40, fontSize: 12, textAlign: 'right' },
  barBg: { flex: 1, height: 20, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  value: { width: 80, fontSize: 12, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
});

export default function TrendsScreen() {
  const colors = useColors();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [merchantQuery, setMerchantQuery] = useState('');

  const { data: trends, isLoading } = useQuery({
    queryKey: ['trends', selectedYear],
    queryFn: () => getTrends({ year: selectedYear }),
  });

  const { data: prevYearTrends } = useQuery({
    queryKey: ['trends', selectedYear - 1],
    queryFn: () => getTrends({ year: selectedYear - 1 }),
  });

  const { data: merchantTrends } = useQuery({
    queryKey: ['merchant-trends', merchantQuery],
    queryFn: () => getMerchantTrends({ query: merchantQuery }),
    enabled: merchantQuery.length >= 2,
  });

  // Summary cards
  const summary = useMemo(() => {
    if (!trends?.monthly_totals?.length) return null;
    const totals = trends.monthly_totals;
    const totalExpenses = totals.reduce((s, m) => s + m.expenses, 0);
    const totalIncome = totals.reduce((s, m) => s + m.income, 0);
    const avgMonthly = totalExpenses / totals.length;
    const savings = totalIncome - totalExpenses;

    const prevTotals = prevYearTrends?.monthly_totals || [];
    const prevExpenses = prevTotals.reduce((s, m) => s + m.expenses, 0);
    const yoyChange = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;

    return { totalExpenses, totalIncome, avgMonthly, savings, yoyChange };
  }, [trends, prevYearTrends]);

  // Monthly spending data for bar chart
  const monthlyBars = useMemo(() => {
    if (!trends?.monthly_totals) return [];
    return trends.monthly_totals.map((m) => {
      const monthNum = parseInt(m.month.split('-')[1]);
      return {
        label: getShortMonthName(monthNum),
        value: m.expenses,
      };
    });
  }, [trends]);

  const monthlyMax = useMemo(() => Math.max(...monthlyBars.map((b) => b.value), 1), [monthlyBars]);

  // Top categories
  const topCategories = useMemo(() => {
    if (!trends?.by_category) return [];
    return trends.by_category.slice(0, 10).map((c) => ({
      label: c.category,
      value: c.total,
    }));
  }, [trends]);

  const categoryMax = useMemo(() => Math.max(...topCategories.map((c) => c.value), 1), [topCategories]);

  // Top merchants
  const topMerchants = useMemo(() => {
    if (!trends?.by_merchant) return [];
    return trends.by_merchant.slice(0, 10).map((m) => ({
      label: m.merchant,
      value: m.total,
    }));
  }, [trends]);

  const merchantMax = useMemo(() => Math.max(...topMerchants.map((m) => m.value), 1), [topMerchants]);

  // Merchant trend bars
  const merchantTrendBars = useMemo(() => {
    if (!merchantTrends?.months) return [];
    return merchantTrends.months.map((m) => {
      const monthNum = parseInt(m.month.split('-')[1]);
      return { label: getShortMonthName(monthNum), value: m.total };
    });
  }, [merchantTrends]);

  const merchantTrendMax = useMemo(() => Math.max(...merchantTrendBars.map((b) => b.value), 1), [merchantTrendBars]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      {/* Year Selector */}
      <View style={[styles.yearNav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.yearText, { color: colors.foreground }]}>{selectedYear}</Text>
        <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Spent</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatCurrency(summary.totalExpenses)}</Text>
            {summary.yoyChange !== 0 && (
              <Text style={[styles.yoyText, { color: summary.yoyChange > 0 ? colors.destructive : colors.success }]}>
                {summary.yoyChange > 0 ? '+' : ''}{summary.yoyChange.toFixed(1)}% YoY
              </Text>
            )}
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Monthly Avg</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatCurrency(summary.avgMonthly)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(summary.totalIncome)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Savings</Text>
            <Text style={[styles.summaryValue, { color: summary.savings >= 0 ? colors.success : colors.destructive }]}>
              {formatCurrency(summary.savings)}
            </Text>
          </View>
        </View>
      )}

      {/* Monthly Spending */}
      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Spending</Text>
        <BarChart data={monthlyBars} colors={colors} maxValue={monthlyMax} />
      </View>

      {/* Top Categories */}
      {topCategories.length > 0 && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Categories</Text>
          <BarChart data={topCategories} colors={colors} maxValue={categoryMax} />
        </View>
      )}

      {/* Top Merchants */}
      {topMerchants.length > 0 && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Merchants</Text>
          <BarChart data={topMerchants} colors={colors} maxValue={merchantMax} />
        </View>
      )}

      {/* Merchant Search */}
      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Merchant Search</Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Search merchant (e.g. Amazon, Whole Foods)..."
          placeholderTextColor={colors.mutedForeground}
          value={merchantQuery}
          onChangeText={setMerchantQuery}
          autoCapitalize="none"
        />
        {merchantTrends && merchantTrendBars.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.merchantTotal, { color: colors.foreground }]}>
              Total: {formatCurrency(merchantTrends.total_spent)}
            </Text>
            <BarChart data={merchantTrendBars} colors={colors} maxValue={merchantTrendMax} />
          </View>
        )}
        {merchantQuery.length >= 2 && merchantTrendBars.length === 0 && !isLoading && (
          <Text style={[styles.noResults, { color: colors.mutedForeground }]}>No results for "{merchantQuery}"</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100 },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 24 },
  navBtn: { padding: 8 },
  yearText: { fontSize: 20, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  summaryCard: { width: '48%', borderRadius: 12, padding: 14, flexGrow: 1 },
  summaryLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  yoyText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  section: { margin: 16, marginBottom: 0, padding: 16, borderWidth: 1, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  merchantTotal: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  noResults: { textAlign: 'center', marginTop: 16, fontSize: 14 },
});
