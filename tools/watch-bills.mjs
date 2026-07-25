#!/usr/bin/env node
/**
 * watch-bills — alert when a RECURRING bill changes amount.
 *
 * Why this exists: the AAA auto premium rose 52% ($1,950 -> $2,970/yr) at the
 * 2026 renewal and nothing surfaced it. The renewal letter was the only signal,
 * and autopay absorbed the change silently. A recurring charge that quietly
 * re-prices is the most expensive thing money tooling can fail to notice.
 *
 * Detects, per merchant, the latest amount vs the median of prior occurrences.
 * Median (not mean) so one prior spike doesn't mask the next one.
 *
 * Usage:
 *   node watch-bills.mjs [--months 14] [--pct 15] [--abs 10] [--json] [--quiet]
 *
 * Exit codes: 0 = nothing to report, 1 = alerts found (cron/monitor can gate on it).
 */

import { FinanceAPI } from './finance-api.mjs';

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? dflt : process.argv[i + 1];
};
const has = (flag) => process.argv.includes(flag);

const MONTHS = Number(arg('--months', 14));
const PCT = Number(arg('--pct', 10));   // relative threshold
const ABS = Number(arg('--abs', 10));   // absolute $ floor, kills penny noise
const AS_JSON = has('--json');
const QUIET = has('--quiet');

/**
 * A recurring BILL is defined by amount STABILITY, not just frequency. Groceries
 * hit every month too, but swing 100%+ and would drown the signal -- the first
 * version of this tool emitted 29 alerts (Costco, Walmart, restaurants) and
 * missed the actual AAA re-price. Only series whose prior amounts are tight
 * enough to be a "bill" are eligible to alert.
 */
const MAX_CV = Number(arg('--cv', 0.12)); // coefficient of variation of priors
const SKIP_CATEGORIES = new Set(
  (arg('--skip-categories',
    'Income,Hafsa Income,Asif Income,Transfer,Investments,Reimbursement') || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
);
/** Reimbursed items net out to ~$0 and read as a huge "drop". Not a bill change. */
const SKIP_LABEL = /reimburs/i;

/** Collapse "AAA CA Insurance (May - early post)" and "AAA" to one series. */
function normalize(txn) {
  const raw = txn.merchant_name || txn.plaid_name || '';
  return raw
    .replace(/\([^)]*\)/g, ' ')        // drop human annotations
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .slice(0, 3)                        // "tesla car insurance company fremont" -> "tesla car insurance"
    .join(' ');
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Coefficient of variation — stdev/mean. Near 0 = a fixed bill; high = variable spend. */
const cv = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (!mean) return Infinity;
  const varc = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(varc) / mean;
};

function monthsBack(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.unshift({ year: d.getFullYear(), month: d.getMonth() + 1 });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

const api = new FinanceAPI();
const series = new Map(); // key -> [{ym, amount, label, category}]

for (const { year, month } of monthsBack(MONTHS)) {
  let txns;
  try {
    txns = await api.list({ year, month, showHidden: false });
  } catch (e) {
    console.error(`! could not fetch ${year}-${month}: ${e.message}`);
    continue;
  }
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  for (const t of txns) {
    const key = normalize(t);
    if (!key) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    if (!amount) continue;
    if (!series.has(key)) series.set(key, []);
    series.get(key).push({
      ym,
      amount,
      label: t.merchant_name || t.plaid_name,
      category: t.category,
    });
  }
}

const alerts = [];
for (const [key, rows] of series) {
  // One entry per month (a month with two charges = take the largest).
  const byMonth = new Map();
  for (const r of rows) {
    const cur = byMonth.get(r.ym);
    if (!cur || r.amount > cur.amount) byMonth.set(r.ym, r);
  }
  const months = [...byMonth.keys()].sort();
  if (months.length < 4) continue; // not established enough to call recurring

  const latest = byMonth.get(months[months.length - 1]);
  if (SKIP_CATEGORIES.has(String(latest.category || '').toLowerCase())) continue;
  if (SKIP_LABEL.test(String(latest.label || ''))) continue;

  const priors = months.slice(0, -1).map((m) => byMonth.get(m).amount);
  const base = median(priors);
  if (!base) continue;

  // Variable spend is not a bill. Gate on stability of the PRIOR series only --
  // the latest point is what we're testing, so it must not smooth its own alarm.
  const stability = cv(priors);
  if (stability > MAX_CV) continue;

  const delta = latest.amount - base;
  const pct = (delta / base) * 100;
  if (Math.abs(pct) < PCT || Math.abs(delta) < ABS) continue;

  alerts.push({
    merchant: latest.label,
    key,
    category: latest.category,
    baseline: Number(base.toFixed(2)),
    latest: Number(latest.amount.toFixed(2)),
    delta: Number(delta.toFixed(2)),
    pct: Number(pct.toFixed(1)),
    stability: Number(stability.toFixed(3)),
    annualized: Number((delta * 12).toFixed(2)),
    month: latest.ym,
    observations: months.length,
    history: months.map((m) => ({ ym: m, amount: byMonth.get(m).amount })),
  });
}

alerts.sort((a, b) => Math.abs(b.annualized) - Math.abs(a.annualized));

if (AS_JSON) {
  console.log(JSON.stringify({ months: MONTHS, pct: PCT, abs: ABS, alerts }, null, 2));
} else if (!alerts.length) {
  if (!QUIET) console.log(`No recurring bill moved >${PCT}% / $${ABS} in the last ${MONTHS} months.`);
} else {
  console.log(`\n${alerts.length} recurring bill(s) changed — last ${MONTHS} months\n`);
  console.log(
    'Merchant'.padEnd(34) + 'Was'.padStart(10) + 'Now'.padStart(10) +
    'Δ'.padStart(10) + '%'.padStart(8) + '  /yr'
  );
  console.log('─'.repeat(80));
  for (const a of alerts) {
    const sign = a.delta > 0 ? '+' : '';
    console.log(
      String(a.merchant).slice(0, 32).padEnd(34) +
      `$${a.baseline.toFixed(2)}`.padStart(10) +
      `$${a.latest.toFixed(2)}`.padStart(10) +
      `${sign}$${a.delta.toFixed(2)}`.padStart(10) +
      `${sign}${a.pct.toFixed(0)}%`.padStart(8) +
      `  ${sign}$${Math.abs(a.annualized).toFixed(0)}`
    );
  }
  console.log('\nHistory of the largest mover:');
  for (const h of alerts[0].history) console.log(`  ${h.ym}  $${h.amount.toFixed(2)}`);
  console.log();
}

process.exit(alerts.length ? 1 : 0);
