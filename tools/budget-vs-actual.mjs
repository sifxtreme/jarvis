#!/usr/bin/env node
// Compare a month's spending against budget. Output is markdown for direct paste.
// Usage: node budget-vs-actual.mjs [YEAR] [MONTH]
import { FinanceAPI } from './finance-api.mjs';

const now = new Date();
const year = Number(process.argv[2]) || now.getFullYear();
const month = Number(process.argv[3]) || (now.getMonth() + 1);

const api = new FinanceAPI();
const txnsRes = await api.list({ year, month, showHidden: false });
const txns = txnsRes.results || txnsRes;
const budgetsRes = await fetch('https://sifxtre.me/api/budgets', { headers: { Authorization: `Bearer ${process.env.JARVIS_TOKEN}` } }).then(r => r.json());
const budgets = budgetsRes.results || budgetsRes;

const spent = {};
for (const t of txns) {
  if (!t.category) continue;
  spent[t.category] = (spent[t.category] || 0) + Number(t.amount);
}

const fmt = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';

const income = budgets.filter(b => b.expense_type === 'income').sort((a, b) => a.display_order - b.display_order);
const expense = budgets.filter(b => b.expense_type === 'expense').sort((a, b) => a.display_order - b.display_order);

const usedCats = new Set(budgets.map(b => b.name));

console.log(`\n## Budget vs Actual: ${year}-${String(month).padStart(2, '0')}\n`);

// Income
console.log('### Income\n');
console.log('| Category | Actual | Budget | Δ | % |');
console.log('|---|---:|---:|---:|---:|');
let incActual = 0, incBudget = 0;
for (const b of income) {
  const a = spent[b.name] || 0;
  incActual += a; incBudget += Number(b.amount);
  console.log(`| ${b.name} | ${fmt(a)} | ${fmt(b.amount)} | ${a - b.amount >= 0 ? '+' : ''}${fmt(a - b.amount)} | ${pct(a, b.amount)} |`);
}
console.log(`| **Total** | **${fmt(incActual)}** | **${fmt(incBudget)}** | **${incActual - incBudget >= 0 ? '+' : ''}${fmt(incActual - incBudget)}** | **${pct(incActual, incBudget)}** |`);

// Expenses — sort by Δ descending (over budget first)
console.log('\n### Expenses (sorted by overage)\n');
console.log('| Category | Actual | Budget | Δ | % |');
console.log('|---|---:|---:|---:|---:|');
const expRows = expense.map(b => {
  const a = spent[b.name] || 0;
  return { name: b.name, actual: a, budget: Number(b.amount), delta: a - Number(b.amount) };
}).sort((a, b) => b.delta - a.delta);

let expActual = 0, expBudget = 0;
for (const r of expRows) {
  expActual += r.actual; expBudget += r.budget;
  const flag = r.delta > 0 ? ' ⚠️' : '';
  console.log(`| ${r.name} | ${fmt(r.actual)} | ${fmt(r.budget)} | ${r.delta >= 0 ? '+' : ''}${fmt(r.delta)}${flag} | ${pct(r.actual, r.budget)} |`);
}
console.log(`| **Total** | **${fmt(expActual)}** | **${fmt(expBudget)}** | **${expActual - expBudget >= 0 ? '+' : ''}${fmt(expActual - expBudget)}** | **${pct(expActual, expBudget)}** |`);

// Categories spent but not in budget
const offBudget = Object.entries(spent).filter(([cat]) => !usedCats.has(cat)).sort((a, b) => b[1] - a[1]);
if (offBudget.length) {
  console.log('\n### Spent, no budget set\n');
  console.log('| Category | Actual |');
  console.log('|---|---:|');
  for (const [cat, amt] of offBudget) console.log(`| ${cat} | ${fmt(amt)} |`);
}

// Headline
const netActual = incActual - expActual - offBudget.reduce((s, [, a]) => s + a, 0);
const netBudget = incBudget - expBudget;
console.log(`\n### Net\n`);
console.log(`- Actual net: **${fmt(netActual)}**`);
console.log(`- Budgeted net: ${fmt(netBudget)}`);
console.log(`- Δ from budget: ${netActual - netBudget >= 0 ? '+' : ''}${fmt(netActual - netBudget)}`);
