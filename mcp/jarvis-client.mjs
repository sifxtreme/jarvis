// jarvis-client.mjs — the data layer behind the MCP tools.
//
// Wraps the shared FinanceAPI SDK (tools/finance-api.mjs) and enforces the safety rules from
// docs/DIRECTION.md, EVEN THOUGH this is a local stdio server:
//   - MASK finance output (drop raw_data / external_id / account internals; keep only safe fields).
//   - "GROCERY" IS SERVER-DEFINED (category === 'Groceries'), never the model's guess.
//   - ANNOTATE IS APPEND-ONLY (item note), and REFUSES any non-grocery row.
//   - No generic SQL/search/mutation is exposed — only these task-shaped helpers.
//
// Handlers are plain functions so they can be unit-tested against the live API without MCP.

import { FinanceAPI } from '../tools/finance-api.mjs';

// Token comes from env (JARVIS_TOKEN — the same Google-issued JWT the web app uses,
// copied from finances.sifxtre.me). The SDK throws if it's missing.
const api = new FinanceAPI(
  process.env.JARVIS_TOKEN ? { token: process.env.JARVIS_TOKEN } : {},
);

const clamp = (n, lo, hi, dflt) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};
const ymd = (d) => d.toISOString().slice(0, 10);
function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1); return d; }

// --- masking: the ONLY fields that leave to the model provider ---------------
export function maskTxn(t) {
  return {
    id: t.id,
    date: (t.transacted_at || '').slice(0, 10),
    merchant: t.merchant_name || t.plaid_name || 'Unknown',
    amount: Number(t.amount),
    category: t.category || null,
  };
}

// --- store normalization (mirrors grocery.mjs; extend freely) ----------------
const STORES = [
  [/costco/i, 'Costco'], [/sprouts/i, 'Sprouts'], [/trader joe/i, "Trader Joe's"],
  [/whole foods|wholefds/i, 'Whole Foods'], [/ralphs/i, 'Ralphs'], [/\bvons\b/i, 'Vons'],
  [/safeway/i, 'Safeway'], [/\bh ?mart\b/i, 'H Mart'], [/aldi/i, 'Aldi'],
  [/walmart/i, 'Walmart'], [/target/i, 'Target'], [/kroger/i, 'Kroger'],
];
export function storeOf(t) {
  const s = `${t.plaid_name || ''} ${t.merchant_name || ''}`;
  for (const [re, name] of STORES) if (re.test(s)) return name;
  return (t.merchant_name || t.plaid_name || 'Unknown').split('(')[0].trim() || 'Unknown';
}

// --- server-defined grocery predicate ----------------------------------------
const isGrocery = (t) => t.category === 'Groceries' && !t.hidden;

async function groceryRows(months) {
  const res = await api.findByDateRange(ymd(monthsAgo(clamp(months, 1, 36, 6))), ymd(new Date()), { showHidden: false });
  return (res.results || res).filter(isGrocery);
}
async function monthRows({ month, showHidden = false } = {}) {
  const [y, m] = (month || ymd(new Date()).slice(0, 7)).split('-').map(Number);
  const res = await api.list({ year: y, month: m, showHidden });
  return res.results || res;
}
async function budgets() {
  const url = (process.env.JARVIS_API_URL || 'https://sifxtre.me/api') + '/budgets';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.JARVIS_TOKEN}` } }).then((r) => r.json());
  return res.results || res;
}

// =========================== FINANCE (full scope) ============================
export async function finance_list_transactions({ month, category, limit } = {}) {
  let rows = await monthRows({ month });
  if (category) rows = rows.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase());
  return rows.slice(0, clamp(limit, 1, 100, 50)).map(maskTxn);
}
export async function finance_spending_summary({ month } = {}) {
  const rows = await monthRows({ month });
  const by = {};
  for (const t of rows) { if (!t.category) continue; by[t.category] = (by[t.category] || 0) + Number(t.amount); }
  const cats = Object.entries(by).map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
  return { month: month || ymd(new Date()).slice(0, 7), total: Math.round(cats.reduce((a, c) => a + c.total, 0) * 100) / 100, categories: cats };
}
export async function finance_search({ query, months } = {}) {
  if (!query || !query.trim()) throw new Error('query is required');
  const res = await api.findByDateRange(ymd(monthsAgo(clamp(months, 1, 24, 6))), ymd(new Date()), { showHidden: false });
  const q = query.toLowerCase();
  return (res.results || res)
    .filter((t) => `${t.merchant_name} ${t.plaid_name} ${t.category}`.toLowerCase().includes(q))
    .slice(0, 100).map(maskTxn);
}

// =========================== GROCERY (both scopes) ===========================
export async function grocery_spend_by_store({ months } = {}) {
  const rows = await groceryRows(months);
  const by = {};
  for (const t of rows) { const s = storeOf(t); (by[s] ||= { trips: 0, total: 0 }); by[s].trips++; by[s].total += Number(t.amount); }
  const stores = Object.entries(by).map(([store, v]) => ({ store, trips: v.trips, total: Math.round(v.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
  return { months: clamp(months, 1, 36, 6), stores, total: Math.round(stores.reduce((a, s) => a + s.total, 0) * 100) / 100 };
}
export async function grocery_list({ months, limit } = {}) {
  const rows = (await groceryRows(months)).sort((a, b) => (b.transacted_at || '').localeCompare(a.transacted_at || ''));
  return rows.slice(0, clamp(limit, 1, 100, 40)).map((t) => ({
    ...maskTxn(t), store: storeOf(t),
    items: (t.merchant_name || '').includes('(') ? t.merchant_name.slice(t.merchant_name.indexOf('(')) : null,
  }));
}
export async function grocery_candidates({ months } = {}) {
  // grocery rows with no item annotation yet (merchant_name has no "(...)")
  const rows = (await groceryRows(months)).filter((t) => !(t.merchant_name || '').includes('('));
  return rows.sort((a, b) => (b.transacted_at || '').localeCompare(a.transacted_at || ''))
    .map((t) => ({ ...maskTxn(t), store: storeOf(t) }));
}
export async function grocery_budget_status() {
  const month = ymd(new Date()).slice(0, 7);
  const spent = (await monthRows({ month })).filter(isGrocery).reduce((a, t) => a + Number(t.amount), 0);
  const b = (await budgets()).find((x) => x.name === 'Groceries');
  const budget = b ? Number(b.amount) : null;
  return {
    month, category: 'Groceries', spent: Math.round(spent * 100) / 100, budget,
    remaining: budget != null ? Math.round((budget - spent) * 100) / 100 : null,
    pct_used: budget ? Math.round((spent / budget) * 100) : null,
  };
}
// APPEND-ONLY, grocery-guarded annotation.
export async function grocery_annotate({ transaction_id, items } = {}) {
  if (!transaction_id) throw new Error('transaction_id is required');
  if (!items || !items.trim()) throw new Error('items is required');
  const t = await api.get(transaction_id);
  if (!t) throw new Error(`transaction ${transaction_id} not found`);
  if (t.category !== 'Groceries') throw new Error(`refused: #${transaction_id} is "${t.category}", not a grocery transaction`);
  const store = storeOf(t);
  const merchant = `${store} (Groceries: ${items.trim()})`;
  await api.update(Number(transaction_id), { merchant_name: merchant });
  const check = await api.get(transaction_id); // read back — never trust the write
  if (check.merchant_name !== merchant) throw new Error('write not confirmed on read-back');
  return { id: Number(transaction_id), merchant_name: merchant, amount: Number(check.amount) };
}
