#!/usr/bin/env node
// Compare a month's spending against an N-month rolling average.
// Usage: node compare-month.mjs [year] [month] [n-months-baseline]
// Default: current month vs prior 3-month average.

import { FinanceAPI } from './finance-api.mjs';

const args = process.argv.slice(2);
const now = new Date();
const targetYear = parseInt(args[0]) || now.getFullYear();
const targetMonth = parseInt(args[1]) || now.getMonth() + 1;
const baselineMonths = parseInt(args[2]) || 3;

const api = new FinanceAPI();

function priorMonths(year, month, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    let m = month - i;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    out.push({ y, m });
  }
  return out;
}

const baseline = priorMonths(targetYear, targetMonth, baselineMonths);
const baselineLabel = `${baseline[baseline.length - 1].y}-${baseline[baseline.length - 1].m} → ${baseline[0].y}-${baseline[0].m}`;

console.log(`\nTarget:   ${targetYear}-${String(targetMonth).padStart(2, '0')}`);
console.log(`Baseline: ${baselineLabel} (${baselineMonths}-month avg, hidden excluded)\n`);

const baselineTotals = {};
for (const { y, m } of baseline) {
  const txns = await api.list({ year: y, month: m, showHidden: false });
  for (const t of txns) {
    if (t.hidden || !t.category) continue;
    if (!baselineTotals[t.category]) baselineTotals[t.category] = 0;
    baselineTotals[t.category] += t.amount;
  }
}
const avg = Object.fromEntries(
  Object.entries(baselineTotals).map(([k, v]) => [k, v / baselineMonths])
);

const targetTxns = await api.list({ year: targetYear, month: targetMonth, showHidden: false });
const targetTotals = {};
for (const t of targetTxns) {
  if (t.hidden || !t.category) continue;
  if (!targetTotals[t.category]) targetTotals[t.category] = 0;
  targetTotals[t.category] += t.amount;
}

const cats = new Set([...Object.keys(avg), ...Object.keys(targetTotals)]);
const rows = [];
for (const cat of cats) {
  const a = targetTotals[cat] ?? 0;
  const v = avg[cat] ?? 0;
  rows.push({ cat, target: a, avg: v, delta: a - v });
}
rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

console.log(`${'Category'.padEnd(28)}${'Target'.padStart(12)}${'Avg'.padStart(12)}${'Delta'.padStart(12)}`);
console.log('─'.repeat(64));
for (const r of rows) {
  if (Math.abs(r.delta) < 25 && Math.abs(r.target) < 25) continue;
  const sign = r.delta >= 0 ? '+' : '-';
  console.log(
    `${r.cat.padEnd(28)}${('$' + r.target.toFixed(0)).padStart(12)}${('$' + r.avg.toFixed(0)).padStart(12)}${(sign + '$' + Math.abs(r.delta).toFixed(0)).padStart(12)}`
  );
}

const aprIncome = (targetTotals['Asif Income'] ?? 0) + (targetTotals['Hafsa Income'] ?? 0);
const aprExp = Object.entries(targetTotals).filter(([k, v]) => !k.includes('Income') && v > 0).reduce((s, [, v]) => s + v, 0);
const avgIncome = (avg['Asif Income'] ?? 0) + (avg['Hafsa Income'] ?? 0);
const avgExp = Object.entries(avg).filter(([k, v]) => !k.includes('Income') && v > 0).reduce((s, [, v]) => s + v, 0);

console.log('\n─── Bottom Line ───');
console.log(`Income:    Target $${aprIncome.toFixed(0)}  vs  Avg $${avgIncome.toFixed(0)}   (Δ ${aprIncome - avgIncome >= 0 ? '+' : '-'}$${Math.abs(aprIncome - avgIncome).toFixed(0)})`);
console.log(`Expenses:  Target $${aprExp.toFixed(0)}  vs  Avg $${avgExp.toFixed(0)}   (Δ ${aprExp - avgExp >= 0 ? '+' : '-'}$${Math.abs(aprExp - avgExp).toFixed(0)})`);
console.log(`Net:       Target $${(aprIncome - aprExp).toFixed(0)}  vs  Avg $${(avgIncome - avgExp).toFixed(0)}\n`);
