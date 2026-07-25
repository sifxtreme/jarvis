// jarvis-client.mjs — the data layer behind the MCP tools.
//
// Wraps the shared FinanceAPI SDK (tools/finance-api.mjs) and enforces the safety rules from
// docs/DIRECTION.md, EVEN THOUGH this is a local stdio server:
//   - MASK finance output (drop raw_data / external_id / account internals; keep only safe fields).
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

async function monthRows({ month, showHidden = false } = {}) {
  const [y, m] = (month || ymd(new Date()).slice(0, 7)).split('-').map(Number);
  const res = await api.list({ year: y, month: m, showHidden });
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
