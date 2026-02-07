import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView,
  Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../lib/theme';
import { updateTransaction, createTransaction, type Transaction, type Budget, type CreateTransactionData } from '../lib/api';
import { formatDate } from '../lib/utils';
import { format } from 'date-fns';

const CATEGORIES = [
  'Groceries', 'Dining', 'Gas', 'Shopping', 'Entertainment', 'Health',
  'Insurance', 'Utilities', 'Rent/Mortgage', 'Subscriptions', 'Travel',
  'Education', 'Personal Care', 'Gifts', 'Charity', 'Home', 'Auto',
  'Kids', 'Pets', 'Income', 'Transfer', 'Other',
];

const SOURCES = [
  { name: 'Amex Gold', icon: 'card-outline' },
  { name: 'Amex Plat', icon: 'card-outline' },
  { name: 'Chase Sapphire', icon: 'card-outline' },
  { name: 'Visa', icon: 'card-outline' },
  { name: 'Cash', icon: 'cash-outline' },
  { name: 'Venmo', icon: 'phone-portrait-outline' },
  { name: 'Zelle', icon: 'phone-portrait-outline' },
  { name: 'Check', icon: 'document-outline' },
  { name: 'BofA', icon: 'card-outline' },
];

interface Props {
  transaction?: Transaction | null;
  visible: boolean;
  onClose: () => void;
  budgets: Budget[];
  /** Pre-filled data for create mode (e.g., from recurring quick-add) */
  prefill?: Partial<CreateTransactionData> | null;
}

export default function TransactionEditModal({ transaction, visible, onClose, budgets, prefill }: Props) {
  const colors = useColors();
  const isCreateMode = !transaction;

  const [merchantName, setMerchantName] = useState('');
  const [plaidName, setPlaidName] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hidden, setHidden] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (!visible) return;
    if (transaction) {
      setMerchantName(transaction.merchant_name);
      setPlaidName(transaction.plaid_name || '');
      setCategory(transaction.category);
      setSource(transaction.source);
      setAmount(transaction.amount.toString());
      setDateStr(transaction.transacted_at?.split('T')[0] || format(new Date(), 'yyyy-MM-dd'));
      setHidden(transaction.hidden);
      setReviewed(transaction.reviewed);
    } else if (prefill) {
      setMerchantName(prefill.merchant_name || '');
      setPlaidName(prefill.plaid_name || '');
      setCategory(prefill.category || '');
      setSource(prefill.source || '');
      setAmount(prefill.amount?.toString() || '');
      setDateStr(prefill.transacted_at || format(new Date(), 'yyyy-MM-dd'));
      setHidden(prefill.hidden ?? false);
      setReviewed(prefill.reviewed ?? false);
    } else {
      setMerchantName('');
      setPlaidName('');
      setCategory('');
      setSource('');
      setAmount('');
      setDateStr(format(new Date(), 'yyyy-MM-dd'));
      setHidden(false);
      setReviewed(false);
    }
  }, [visible, transaction, prefill]);

  const budgetCategories = useMemo(() => {
    const cats = budgets.map((b) => b.name);
    return [...new Set([...cats, ...CATEGORIES])];
  }, [budgets]);

  const handleSave = async () => {
    if (!merchantName.trim()) {
      Alert.alert('Error', 'Merchant name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (isCreateMode) {
        await createTransaction({
          transacted_at: dateStr,
          plaid_name: plaidName.trim() || merchantName.trim(),
          merchant_name: merchantName.trim(),
          category: category.trim(),
          source: source.trim(),
          amount: parseFloat(amount) || 0,
          hidden,
          reviewed,
        });
      } else {
        await updateTransaction(transaction.id, {
          merchant_name: merchantName.trim(),
          category: category.trim(),
          source: source.trim(),
          amount: parseFloat(amount),
          hidden,
          reviewed,
        });
      }
      onClose();
    } catch {
      Alert.alert('Error', `Failed to ${isCreateMode ? 'create' : 'save'} transaction`);
    } finally {
      setIsSaving(false);
    }
  };

  // Simple date adjustment buttons
  const adjustDate = (days: number) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDateStr(format(d, 'yyyy-MM-dd'));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {isCreateMode ? 'Add Transaction' : 'Edit Transaction'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              <Text style={[styles.saveText, { color: colors.primary }, isSaving && { opacity: 0.5 }]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Date */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Date</Text>
            {isCreateMode ? (
              <View style={styles.dateRow}>
                <TouchableOpacity onPress={() => adjustDate(-1)} style={[styles.dateBtn, { borderColor: colors.border }]}>
                  <Ionicons name="chevron-back" size={18} color={colors.foreground} />
                </TouchableOpacity>
                <View style={[styles.dateDisplay, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.dateText, { color: colors.foreground }]}>{formatDate(dateStr)}</Text>
                </View>
                <TouchableOpacity onPress={() => adjustDate(1)} style={[styles.dateBtn, { borderColor: colors.border }]}>
                  <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.readOnlyField, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>
                  {formatDate(transaction.transacted_at)}
                </Text>
              </View>
            )}

            {/* Vendor (read-only in edit, editable as plaid_name in create) */}
            {isCreateMode ? (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Vendor Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                  value={plaidName}
                  onChangeText={setPlaidName}
                  placeholder="Vendor name (optional)"
                  placeholderTextColor={colors.mutedForeground}
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Vendor (Plaid)</Text>
                <View style={[styles.readOnlyField, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {transaction.plaid_name || '—'}
                  </Text>
                </View>
              </>
            )}

            {/* Merchant Name */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Merchant</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="Merchant name"
              placeholderTextColor={colors.mutedForeground}
            />

            {/* Amount */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, textAlign: 'right' }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
            />

            {/* Category */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={[styles.pickerText, { color: category ? colors.foreground : colors.mutedForeground }]}>
                {category || 'Select category'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={[styles.pickerList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {budgetCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.pickerItem, cat === category && { backgroundColor: colors.accent }]}
                      onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Source */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Source</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowSourcePicker(!showSourcePicker)}
            >
              <Text style={[styles.pickerText, { color: source ? colors.foreground : colors.mutedForeground }]}>
                {source || 'Select source'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showSourcePicker && (
              <View style={[styles.pickerList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {SOURCES.map((s) => (
                  <TouchableOpacity
                    key={s.name}
                    style={[styles.pickerItem, s.name === source && { backgroundColor: colors.accent }]}
                    onPress={() => { setSource(s.name); setShowSourcePicker(false); }}
                  >
                    <Ionicons name={s.icon as any} size={16} color={colors.foreground} style={{ marginRight: 8 }} />
                    <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Toggles */}
            <View style={[styles.toggleSection, { borderTopColor: colors.border }]}>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Hidden</Text>
                <Switch value={hidden} onValueChange={setHidden} trackColor={{ true: colors.primary }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Reviewed</Text>
                <Switch value={reviewed} onValueChange={setReviewed} trackColor={{ true: colors.primary }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  cancelText: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  saveText: { fontSize: 16, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  readOnlyField: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  readOnlyText: { fontSize: 15 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { borderWidth: 1, borderRadius: 8, padding: 10 },
  dateDisplay: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  dateText: { fontSize: 15, fontWeight: '500' },
  pickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15 },
  pickerList: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  pickerItemText: { fontSize: 15 },
  toggleSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, gap: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 15 },
});
