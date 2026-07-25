// Chase (hafsa_chase) CSV import — 2026-07-25 drop.
//
// WHY THIS IS NOT import-bofa.mjs:
//   Teller synced hafsa_chase through 2026-07-05 (last txn), then froze. This CSV spans
//   2025-12-29 → 2026-07-22, so most rows are ALREADY in the DB. Teller rows carry curated
//   merchant_name; the CSV carries raw descriptors — they never match on name. So we dedup on
//   a MULTISET of (transaction_date, amount) AND a date floor at the last synced txn.
//
// THE TRAP WE FOUND (2026-07-25): 12 pre-freeze CSV rows looked like "surplus" because Hafsa
//   had manually NETTED GoodRx/reimbursements into the DB amount (e.g. CSV Grubhub 63.04 →
//   DB 28.04 "reimbursement for 35"; Costco 130.20 → split into 112.42+17.78; Tesla 220.39 →
//   posted 06-01 not 05-29). Every one is the SAME charge already in the DB at a different
//   amount/date. Importing them would double-count at inflated amounts. => we ONLY import rows
//   dated AFTER LAST_SYNCED. Everything on/before it is represented in the DB.
//
// SIGN (verified against live rows): Chase CSV Sale=neg, Return/Payment=pos; Jarvis spend=POS,
//   credit=NEG. jarvis_amount = -csv_amount, uniform across every Type.
// DATE: Jarvis transacted_at == CSV col 1 "Transaction Date" (NOT Post Date). Verified.
// PAYMENTS: CC pay-offs (Type=Payment) → hidden=true (Teller did the same).
// PROVENANCE: each row gets a deterministic synthetic plaid_id (the poorly-named generic
//   transaction_id) → csv:hafsa_chase:<date>:<amount>:<descslug>:<n>. Re-dropping the same
//   statement is idempotent (script skips any synthetic id already in existing_csv_ids.txt).
//
// Run: node import-chase.mjs --dry-run   |   node import-chase.mjs

import { readFileSync } from 'node:fs';
import { FinanceAPI } from './finance-api.mjs';

const api = new FinanceAPI();
const DRY = process.argv.includes('--dry-run');

const CSV_PATH = '/Users/asifahmed/Downloads/Chase5797_Activity_20260725.csv';
const SCRATCH = '/private/tmp/claude-501/-Users-asifahmed-code/94ae78ab-8c9a-4016-b026-0fcfc6d3167f/scratchpad';
const EXISTING_PATH = `${SCRATCH}/existing_hafsa_chase.txt`;      // date|amount (raw, whole window)
const EXISTING_IDS_PATH = `${SCRATCH}/existing_csv_ids.txt`;      // synthetic plaid_ids already in DB
const LAST_SYNCED = '2026-07-05';                                 // newest hafsa_chase txn Teller got
const SOURCE = 'hafsa_chase';

// merchant_name + category for each genuinely-new (post-freeze) row, keyed by raw descriptor.
// Categories drawn from learned hafsa_chase history where one existed; (?) = my guess, confirm.
const MAP = {
  'DENVER CENTRAL MARKET':       ['Denver Central Market',   'Eating Out'],
  'DAZBOG A':                    ['Dazbog Coffee',           'Eating Out'],
  'ARLO NOMAD BODEGA':           ['Arlo Nomad (bodega)',     'Eating Out'],
  'Cosmetics Co 23rd Str':       ['Cosmetics Co (NYC)',      'Personal Care'],
  'ARLO NOMAD':                  ['Arlo Nomad Hotel',        'Travel and Trips'],
  'BRYANT PK MARKET ST237':      ['Bryant Park Market',      'Eating Out'],
  'SP RAMP SHOP':                ['Ramp Shop',               'Home'],            // (?) unclear merchant
  'CATER TOTS TOO':              ['Cater Tots Too',          'Eating Out'],
  'ANTHROPIC* CLAUDE SUB':       ['Anthropic (Claude)',      'Hafsa Career'],    // learned: Claude→Hafsa Career (?)
  'COSTCO WHSE #1050':           ['Costco',                  'Groceries'],
  'JetBlue':                     ['JetBlue (refund)',        'Travel and Trips'],
  'SPROUTS FARMERS MAR':         ['Sprouts',                 'Groceries'],
  'SMOKING TIGER COFFEE AND':    ['Smoking Tiger Coffee',    'Eating Out'],
  'LEVELS':                      ['Levels (refund)',         'Personal Care'],   // learned: Levels→Personal Care
  'ISLAMICSOCIETYOOC_ISOC':      ['Islamic Society (ISOC)',  'Charity'],         // Asif 2026-07-25: donation, not tuition
  'APPLE.COM/BILL':              ['Apple',                   'Dues & Subscriptions'],
  'DUN&amp; BRADSTREET ONLINE':  ['Dun & Bradstreet',        'Hafsa Career'],    // learned
  'ZENNI OPTICAL':               ['Zenni Optical',           'Personal Care'],   // (?) glasses; or Medical Expenses
  'BARAKAH BAZAAR':              ['Barakah Bazaar',          'Charity'],         // (?) Islamic bazaar
  'Payment Thank You-Mobile':    ['Payment',                 'Credit Card Payment', true], // HIDDEN
  'AUTOMATIC PAYMENT - THANK':   ['Payment',                 'Credit Card Payment', true], // HIDDEN
  'NPO* THE MAJLIS':             ['NPO The Majlis',          'Charity'],         // learned: Majlis→Charity
  'CSA-GGA-DAMAGE INSURAN':      ['Vrbo Damage Waiver',      'Travel and Trips'],
  'SP VERONA UNIFORMS':          ['Verona Uniforms',         'Yusuf + Musa'],    // (?) kids school uniforms
  'Vrbo HAVB5J41':               ['Vrbo',                    'Travel and Trips'],
  'ALASKA AIR 0272152879662':    ['Alaska Air',              'Travel and Trips'],// learned: Alaska Air→Travel
  'ALASKA AIR 0272152879661':    ['Alaska Air',              'Travel and Trips'],
};

function mmddyyyy(s) { const [m, d, y] = s.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
const slug = (s) => s.toLowerCase().replace(/&amp;/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);

function parseCsv() {
  const lines = readFileSync(CSV_PATH, 'utf8').trim().split('\n');
  lines.shift();
  return lines.map((ln) => {
    const [txnDate,, descRaw,, type, amount] = ln.split(',');
    return {
      date: mmddyyyy(txnDate),
      descRaw: descRaw.replace(/\s+/g, ' ').trim(),
      type,
      csvAmount: parseFloat(amount),
      jarvisAmount: Math.round(-parseFloat(amount) * 100) / 100,
    };
  });
}
function loadCounts(path) {
  const m = new Map();
  for (const ln of readFileSync(path, 'utf8').trim().split('\n')) {
    if (!ln) continue;
    const [date, amt] = ln.split('|');
    const k = `${date}|${(Math.round(parseFloat(amt)*100)/100).toFixed(2)}`;
    m.set(k, (m.get(k)||0)+1);
  }
  return m;
}
function loadSet(path) {
  try { return new Set(readFileSync(path,'utf8').trim().split('\n').filter(Boolean)); }
  catch { return new Set(); }
}

async function main() {
  const rows = parseCsv();
  const existing = loadCounts(EXISTING_PATH);
  const remaining = new Map(existing);
  const existingIds = loadSet(EXISTING_IDS_PATH);

  const preFreezeDupes = [];   // excluded: on/before LAST_SYNCED (already in DB, possibly netted)
  const toImport = [];         // after LAST_SYNCED, not already imported
  const occ = new Map();       // occurrence index per (date|amount|descslug)

  for (const r of rows) {
    const k = `${r.date}|${r.jarvisAmount.toFixed(2)}`;
    const inDbByAmount = (remaining.get(k)||0) > 0;
    if (inDbByAmount) remaining.set(k, remaining.get(k)-1);

    if (r.date <= LAST_SYNCED) {
      // Everything in Teller's synced range is represented in the DB. If it didn't match by
      // amount, it's a netted/split/post-dated version of an existing row — NOT a new charge.
      if (!inDbByAmount) preFreezeDupes.push(r);
      continue;
    }
    // post-freeze = genuine gap
    const oc = `${k}|${slug(r.descRaw)}`;
    const n = occ.get(oc) || 0; occ.set(oc, n+1);
    const plaidId = `csv:${SOURCE}:${r.date}:${r.jarvisAmount.toFixed(2)}:${slug(r.descRaw)}:${n}`;
    if (existingIds.has(plaidId)) continue; // idempotent re-run
    const mapped = MAP[r.descRaw];
    if (!mapped) { console.error(`NO MAP for: "${r.descRaw}" (${r.date} ${r.jarvisAmount})`); process.exitCode = 1; continue; }
    const [merchant, category, hidden] = mapped;
    toImport.push({ ...r, plaidId, merchant, category, hidden: !!hidden });
  }

  console.log(`Chase CSV: ${rows.length} rows (${rows[rows.length-1].date} → ${rows[0].date})`);
  console.log(`LAST_SYNCED (Teller): ${LAST_SYNCED} — importing only rows AFTER this.\n`);

  console.log(`EXCLUDED — ${preFreezeDupes.length} pre-freeze rows already in DB (reimbursement-netted / split / post-dated):`);
  for (const r of preFreezeDupes) console.log(`   ${r.date}  ${String(r.jarvisAmount).padStart(9)}  ${r.descRaw}`);

  console.log(`\nIMPORT — ${toImport.length} genuinely-new post-freeze rows:`);
  console.log('date        amount    category               merchant  (raw)');
  console.log('─'.repeat(90));
  for (const r of toImport) {
    console.log(`${r.date}  ${String(r.jarvisAmount).padStart(9)}  ${r.category.padEnd(21)}  ${r.merchant}${r.hidden?'  [HIDDEN]':''}  «${r.descRaw}»`);
  }

  if (DRY) { console.log(`\n[DRY RUN] nothing written. ${toImport.length} would be created.`); return; }

  let n = 0;
  for (const r of toImport) {
    await api.create({
      merchant_name: r.merchant,
      category: r.category,
      amount: r.jarvisAmount,
      transacted_at: r.date,
      source: SOURCE,
      plaid_id: r.plaidId,
      ...(r.hidden ? { hidden: true } : {}),
    });
    n++;
  }
  console.log(`\n✅ created ${n} transactions`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
