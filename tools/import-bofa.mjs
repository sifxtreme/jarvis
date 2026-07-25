// One-off BofA statement import (June + July 2026).
// Run: node import-bofa.mjs --dry-run   |   node import-bofa.mjs
//
// Decisions were made interactively with Asif (2026-07-12). Encoded here rather
// than re-derived, so the dry run and the real run are guaranteed identical.
//
// Sign convention (verified against existing rows): expenses POSITIVE, income
// POSITIVE (the category makes it income), refunds/reimbursements NEGATIVE so they
// net against the category. GoodRx reimbursements are therefore negative Eating Out.
import { FinanceAPI } from './finance-api.mjs';

const api = new FinanceAPI();
const DRY = process.argv.includes('--dry-run');

const ROWS = [
  // ---------- JUNE ----------
  { d: '2026-06-02', m: 'GoodRx Reimbursement',      c: 'Eating Out',   a: -171.67, s: 'bofa' },
  { d: '2026-06-03', m: 'GoodRx Reimbursement',      c: 'Eating Out',   a:  -49.00, s: 'bofa' },
  { d: '2026-06-08', m: 'GoodRx Reimbursement',      c: 'Eating Out',   a: -269.80, s: 'bofa' },
  { d: '2026-06-23', m: 'ISOC',                      c: 'Charity',      a:  100.00, s: 'bofa' },
  { d: '2026-06-23', m: 'PNM Electric (Suhail)',     c: 'Asif Parents', a:  445.00, s: 'bofa', hidden: true },
  { d: '2026-06-26', m: 'Hafsa Income',              c: 'Hafsa Income', a: 4454.93, s: 'bofa' },
  { d: '2026-06-29', m: 'GoodRx Reimbursement',      c: 'Eating Out',   a: -105.00, s: 'bofa' },
  { d: '2026-06-29', m: 'Alisha Stewart',            c: 'Babysitting',  a:  235.75, s: 'zelle' },
  { d: '2026-06-30', m: 'Asif Income',               c: 'Asif Income',  a: 6311.60, s: 'bofa' },
  { d: '2026-06-30', m: '776 Fund Wire (SVB)',       c: 'Investment',   a: 5000.00, s: 'bofa', hidden: true },
  { d: '2026-06-30', m: 'Wire Transfer Fee',         c: 'Investment',   a:   30.00, s: 'bofa', hidden: true },
  { d: '2026-06-30', m: 'Frontier',                  c: 'Internet',     a:   64.99, s: 'bofa', hidden: true },

  // ---------- JULY ----------
  { d: '2026-07-01', m: 'GoodRx Reimbursement',      c: 'Eating Out',   a: -133.00, s: 'bofa' },
  { d: '2026-07-01', m: 'AAA CA Insurance',          c: 'Car Insurance',a:  169.00, s: 'bofa' },
  { d: '2026-07-02', m: 'Adam Mo (Venmo)',           c: 'Eating Out',   a:   50.00, s: 'venmo' },
  { d: '2026-07-03', m: 'Alisha Stewart',            c: 'Babysitting',  a:  241.50, s: 'zelle' },
  { d: '2026-07-03', m: 'Orange Crescent School',    c: 'Tuition',      a: 1230.00, s: 'bofa' },
  { d: '2026-07-03', m: 'Tesla',                     c: 'Tesla',        a:  724.17, s: 'bofa' },
  { d: '2026-07-09', m: 'Alisha Stewart',            c: 'Babysitting',  a:  283.00, s: 'zelle' },
];

// Skipped on purpose — recorded so the reasoning survives.
const SKIPPED = [
  ['Jun 1',  'VENMO CASHOUT +$421',            'internal transfer (Venmo balance -> bank)'],
  ['Jun 1',  'VENMO PAYMENT -$10',             'no memo, tiny — Asif: skip'],
  ['Jun 1',  'KEEP THE CHANGE -$0.93',         'internal BofA savings sweep'],
  ['Jun 3',  'Mobile transfers +$2,766',       'internal / family BofA accounts'],
  ['Jun 11', 'Zelle FROM Reema Afsar +$2,000', 'Asif: skip (not income)'],
  ['Jun 15', 'AMEX ACH x2 -$7,372',            'credit-card payment — tracked on the card side'],
  ['Jun 16', 'CHASE CREDIT CRD -$2,593',       'credit-card payment — tracked on the card side'],
  ['Jun 17', 'APPLECARD -$52.82',              'credit-card payment — tracked on the card side'],
  ['Jun 23', 'Transfer to SAV -$2,000',        'internal savings transfer'],
  ['Jun 24', 'Mobile deposit +$14',            'Asif: skip'],
  ['Jul 3',  'Zelle to Zaku -$100',            'pass-through of Jameela’s grad gift, not our spend'],
  ['Jul 3',  'VENMO PAYMENT -$25',             'no memo — Asif: skip'],
  ['Jul 6-7','Mobile transfers +$2,728',       'internal / family BofA accounts'],
  ['Jul 7-8','Ramp micro-verifications',       'account-verification pennies, net ~0'],
];

const key = (t) => `${t.transacted_at?.slice(0, 10)}|${Number(t.amount).toFixed(2)}|${(t.merchant_name || '').toLowerCase()}`;

async function main() {
  // Pull everything already in both months so we can hard-block a duplicate.
  const existing = [
    ...(await api.list({ year: 2026, month: 6 })),
    ...(await api.list({ year: 2026, month: 7 })),
  ];
  const seen = new Set(existing.map(key));

  console.log(`${DRY ? 'DRY RUN' : 'IMPORTING'} — ${ROWS.length} candidate rows\n`);

  const toCreate = [];
  for (const r of ROWS) {
    const k = `${r.d}|${r.a.toFixed(2)}|${r.m.toLowerCase()}`;
    if (seen.has(k)) {
      console.log(`  DUPE-SKIP  ${r.d}  $${r.a}  ${r.m}`);
      continue;
    }
    toCreate.push(r);
    console.log(`  ${DRY ? 'would add' : 'ADD     '}  ${r.d}  ${String(r.a).padStart(9)}  ${r.m.padEnd(24)} ${r.c}${r.hidden ? '  [HIDDEN]' : ''}`);
  }

  console.log(`\nSkipped by rule/decision (${SKIPPED.length}):`);
  SKIPPED.forEach(([d, what, why]) => console.log(`  ${d.padEnd(8)} ${what.padEnd(34)} ${why}`));

  if (DRY) {
    console.log(`\n[DRY RUN] nothing written. ${toCreate.length} would be created.`);
    return;
  }

  let n = 0;
  for (const r of toCreate) {
    await api.create({
      merchant_name: r.m,
      category: r.c,
      amount: r.a,
      transacted_at: r.d,
      source: r.s,
      ...(r.hidden ? { hidden: true } : {}),
    });
    n++;
  }
  console.log(`\n✅ created ${n} transactions`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
