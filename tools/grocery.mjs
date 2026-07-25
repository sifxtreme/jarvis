#!/usr/bin/env node
// grocery.mjs — grocery-spend primitives for Jarvis.
//
// FOR HAFSA'S CLAUDE: this is your starting toolkit for grocery analysis. It reads the same
// Jarvis finance DB the whole family uses, but filters to the "Groceries" category and groups
// by store. Everything here is READ-ONLY except `items` (which annotates one transaction).
// It's meant to be extended — add commands, ask your Claude to build on these primitives.
//
// Usage:
//   node grocery.mjs stores  [months=6]     spend by store (Costco, Sprouts, …), last N months
//   node grocery.mjs trend   [months=12]    total grocery spend per month
//   node grocery.mjs recent  [limit=25]     recent grocery purchases (with their id + any items)
//   node grocery.mjs search  <term>         grocery purchases matching a store/item term
//   node grocery.mjs items   <id> "eggs, milk, bread"   tag a purchase with what was bought
//   node grocery.mjs help
//
// Data note: grocery rows carry a store descriptor (plaid_name, e.g. "COSTCO WHSE #1050") and a
// merchant_name that sometimes already lists items ("Costco (Groceries: cookies, cashews …)").
// `items` follows that same convention so annotations stay consistent and searchable.

import { FinanceAPI } from './finance-api.mjs';

const api = new FinanceAPI();
const [cmd, ...rest] = process.argv.slice(2);

// Map a raw store descriptor -> a clean store name. Extend this list freely.
const STORES = [
  [/costco/i, 'Costco'],
  [/sprouts/i, 'Sprouts'],
  [/trader joe/i, "Trader Joe's"],
  [/whole foods|wholefds/i, 'Whole Foods'],
  [/ralphs/i, 'Ralphs'],
  [/\bvons\b/i, 'Vons'],
  [/safeway/i, 'Safeway'],
  [/\bh mart|hmart/i, 'H Mart'],
  [/aldi/i, 'Aldi'],
  [/walmart/i, 'Walmart'],
  [/target/i, 'Target'],
  [/kroger/i, 'Kroger'],
  [/grocery outlet/i, 'Grocery Outlet'],
];
function storeOf(t) {
  const s = `${t.plaid_name || ''} ${t.merchant_name || ''}`;
  for (const [re, name] of STORES) if (re.test(s)) return name;
  // fall back to the merchant_name up to the first "(" so annotations don't fragment the group
  return (t.merchant_name || t.plaid_name || 'Unknown').split('(')[0].trim() || 'Unknown';
}
const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ymd = (d) => d.toISOString().slice(0, 10);

function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1); return d; }

async function groceryTxns(months) {
  // findByDateRange returns raw (non-amortized) rows; we keep only Groceries, non-hidden.
  const start = ymd(monthsAgo(months));
  const end = ymd(new Date());
  const res = await api.findByDateRange(start, end, { showHidden: false });
  const rows = res.results || res;
  return rows.filter((t) => t.category === 'Groceries' && !t.hidden);
}

async function cmdStores(months = 6) {
  const txns = await groceryTxns(months);
  const by = {};
  for (const t of txns) {
    const s = storeOf(t);
    (by[s] ||= { n: 0, total: 0 });
    by[s].n++; by[s].total += Number(t.amount);
  }
  const rows = Object.entries(by).sort((a, b) => b[1].total - a[1].total);
  const grand = rows.reduce((a, [, v]) => a + v.total, 0);
  console.log(`\nGrocery spend by store — last ${months} months (${txns.length} purchases)\n`);
  console.log('store'.padEnd(18) + 'trips'.padStart(7) + 'total'.padStart(13) + '   avg/trip   share');
  console.log('─'.repeat(60));
  for (const [s, v] of rows) {
    const share = grand ? Math.round((v.total / grand) * 100) + '%' : '—';
    console.log(s.padEnd(18) + String(v.n).padStart(7) + money(v.total).padStart(13) + money(v.total / v.n).padStart(11) + share.padStart(7));
  }
  console.log('─'.repeat(60));
  console.log('TOTAL'.padEnd(18) + String(txns.length).padStart(7) + money(grand).padStart(13));
}

async function cmdTrend(months = 12) {
  const txns = await groceryTxns(months);
  const by = {};
  for (const t of txns) {
    const m = (t.transacted_at || '').slice(0, 7);
    if (!m) continue;
    (by[m] ||= 0); by[m] += Number(t.amount);
  }
  const rows = Object.entries(by).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(...rows.map(([, v]) => v), 1);
  console.log(`\nMonthly grocery spend — last ${months} months\n`);
  for (const [m, v] of rows) {
    const bar = '█'.repeat(Math.round((v / max) * 32));
    console.log(`${m}  ${money(v).padStart(11)}  ${bar}`);
  }
  const avg = rows.reduce((a, [, v]) => a + v, 0) / (rows.length || 1);
  console.log(`\navg/month: ${money(avg)}`);
}

async function cmdRecent(limit = 25) {
  const txns = (await groceryTxns(6)).sort((a, b) => (b.transacted_at || '').localeCompare(a.transacted_at || '')).slice(0, limit);
  console.log(`\nRecent grocery purchases (id shown so you can annotate with \`items\`)\n`);
  console.log('id'.padEnd(8) + 'date'.padEnd(12) + 'amount'.padStart(10) + '  store / items');
  console.log('─'.repeat(72));
  for (const t of txns) {
    const items = (t.merchant_name || '').includes('(') ? '  ' + t.merchant_name.slice(t.merchant_name.indexOf('(')) : '';
    console.log(String(t.id).padEnd(8) + (t.transacted_at || '').slice(0, 10).padEnd(12) + money(Number(t.amount)).padStart(10) + '  ' + storeOf(t) + items);
  }
}

async function cmdSearch(term) {
  if (!term) return console.error('usage: node grocery.mjs search <term>');
  const txns = (await groceryTxns(24)).filter((t) => `${t.plaid_name} ${t.merchant_name}`.toLowerCase().includes(term.toLowerCase()));
  console.log(`\n${txns.length} grocery purchases matching "${term}" (last 24 months)\n`);
  for (const t of txns.sort((a, b) => (b.transacted_at || '').localeCompare(a.transacted_at || ''))) {
    console.log(`${String(t.id).padEnd(8)}${(t.transacted_at || '').slice(0, 10)}  ${money(Number(t.amount)).padStart(10)}  ${t.merchant_name || t.plaid_name}`);
  }
}

async function cmdItems(id, itemStr) {
  if (!id || !itemStr) return console.error('usage: node grocery.mjs items <id> "eggs, milk, bread"');
  const t = await api.get(id);
  const store = storeOf(t);
  const merchant = `${store} (Groceries: ${itemStr.trim()})`;
  await api.update(Number(id), { merchant_name: merchant });
  const check = await api.get(id); // read back — don't trust the write
  console.log(check.merchant_name === merchant
    ? `✅ #${id} → ${merchant}`
    : `❌ write not confirmed. now: ${check.merchant_name}`);
}

const HELP = `grocery.mjs — grocery-spend primitives
  node grocery.mjs stores  [months=6]     spend by store, last N months
  node grocery.mjs trend   [months=12]    total grocery spend per month
  node grocery.mjs recent  [limit=25]     recent purchases (with id + items)
  node grocery.mjs search  <term>         purchases matching a store/item term
  node grocery.mjs items   <id> "eggs, milk"   annotate a purchase with items
`;

try {
  if (cmd === 'stores') await cmdStores(Number(rest[0]) || 6);
  else if (cmd === 'trend') await cmdTrend(Number(rest[0]) || 12);
  else if (cmd === 'recent') await cmdRecent(Number(rest[0]) || 25);
  else if (cmd === 'search') await cmdSearch(rest[0]);
  else if (cmd === 'items') await cmdItems(rest[0], rest.slice(1).join(' '));
  else console.log(HELP);
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
