import fs from 'fs';

const API_BASE_URL = 'https://sifxtre.me/api';
const API_KEY = 'ENTAROTASSADAR';

// Load Amazon transactions from JSON
function loadAmazonTransactions() {
  const data = JSON.parse(fs.readFileSync('./amazon_transactions.json', 'utf8'));
  return {
    charges: data.transactions.filter(t => t.type === 'charge'),
    refunds: data.transactions.filter(t => t.type === 'refund')
  };
}

// Fetch transactions from finance tracker API
async function fetchFinanceTransactions(year, month) {
  const params = new URLSearchParams({
    year: year.toString(),
    month: month.toString(),
    show_hidden: 'false'
  });

  const response = await fetch(`${API_BASE_URL}/financial_transactions?${params}`, {
    headers: { 'Authorization': API_KEY }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

// Update a transaction via API
async function updateTransaction(id, data) {
  const response = await fetch(`${API_BASE_URL}/financial_transactions/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Update failed for ${id}: ${response.status}`);
  }

  return response.json();
}

// Find Amazon transactions that need item descriptions
// NOTE: Auto-categorization sets category but NOT merchant_name, so we need to
// find transactions missing merchant_name even if they already have a category
// A bare "Amazon" is NOT an itemization — turning it into "Amazon - <item>" is this
// pipeline's whole job. This used to key on `!t.merchant_name` (null only), which
// broke the moment the Rails predictor started backfilling Plaid's clean
// merchant_name ("Amazon") onto every Amazon row: suddenly every row "had a name"
// and the matcher silently found nothing to do. Treat a GENERIC Amazon label as
// still needing an item name.
//
// Anything more specific is left alone: "Amazon - Diapers", "Amazon Prime" (a real
// subscription), a Kindle book title, "Amazon Fresh - Groceries".
const GENERIC_AMAZON_NAMES = new Set([
  'amazon',
  'amazon.com',
  'amazon marketplace',
  'amazon market place',
  'amazon mktpl',
  'amzn'
]);

function needsItemName(merchantName) {
  if (!merchantName) return true;
  return GENERIC_AMAZON_NAMES.has(merchantName.trim().toLowerCase());
}

function findAmazonNeedingNames(transactions) {
  return transactions.filter(t => {
    // Check if plaid_name contains amazon/amzn (case insensitive)
    const isAmazon = t.plaid_name?.toLowerCase().includes('amazon') ||
                     t.plaid_name?.toLowerCase().includes('amzn');
    // Missing OR generic merchant_name (see above)
    const needsName = needsItemName(t.merchant_name);
    // Exclude AWS
    const isNotAWS = !t.plaid_name?.toLowerCase().includes('aws');

    return isAmazon && needsName && isNotAWS;
  });
}

// Separate charges (positive amounts) from refunds (negative amounts)
function separateByType(transactions) {
  return {
    charges: transactions.filter(t => t.amount > 0),
    refunds: transactions.filter(t => t.amount < 0)
  };
}

const AMOUNT_TOL = 0.01;     // cents rounding
const SOFT_WINDOW_DAYS = 4;  // expected card-posting lag vs Amazon's date

// Greedy 1:1 assignment — each Amazon order is consumed at most once.
//
// Replaces the old per-row filter that had two fatal flaws:
//   1. When 2 same-amount orders both fell inside the date window, the caller's
//      "multiple matches" branch printed a warning and matched NEITHER — so
//      same-amount pairs (2×$33.14, 2×$27.61) were silently dropped.
//   2. No consumption: one Amazon order could be claimed by several finance rows.
//
// Strategy: process finance rows earliest-first; each claims the NEAREST-date
// still-available order of the same amount. Earliest charge → earliest order
// keeps dup-amount pairs stably 1:1. No hard date reject (a same-amount unused
// order is almost certainly the one), but the day gap is recorded for review.
function assignMatches(financeTxns, amazonTxns) {
  const pool = amazonTxns.map(a => ({ ...a, _used: false }));
  const sorted = [...financeTxns].sort(
    (a, b) => new Date(a.transacted_at) - new Date(b.transacted_at));

  const out = [];
  for (const ft of sorted) {
    const target = Math.abs(ft.amount);
    const fDate = new Date(ft.transacted_at.split('T')[0]);
    const cands = pool.filter(
      a => !a._used && Math.abs(Math.abs(a.amount) - target) < AMOUNT_TOL);
    if (cands.length === 0) { out.push({ ft, match: null }); continue; }

    cands.sort((x, y) =>
      Math.abs(new Date(x.date) - fDate) - Math.abs(new Date(y.date) - fDate));
    const best = cands[0];
    best._used = true;
    const gapDays = Math.round(Math.abs(new Date(best.date) - fDate) / 86400000);
    out.push({ ft, match: best, gapDays });
  }
  return out;
}

async function main() {
  console.log('Loading Amazon transactions from JSON...');
  const amazon = loadAmazonTransactions();
  console.log(`Found ${amazon.charges.length} Amazon charges, ${amazon.refunds.length} refunds\n`);

  console.log('Fetching finance tracker transactions...');

  // Dynamically determine months to fetch based on scraped Amazon date range
  const amazonData = JSON.parse(fs.readFileSync('./amazon_transactions.json', 'utf8'));
  const dateRange = amazonData.summary?.date_range || {};
  const fromDate = new Date(dateRange.from || new Date());
  const toDate = new Date(dateRange.to || new Date());

  // Get unique year-month pairs to fetch
  const monthsToFetch = new Set();
  let current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (current <= toDate) {
    monthsToFetch.add(`${current.getFullYear()}-${current.getMonth() + 1}`);
    current.setMonth(current.getMonth() + 1);
  }

  // Fetch all needed months
  const allFinanceTransactions = [];
  const fetchedMonths = [];
  for (const ym of monthsToFetch) {
    const [year, month] = ym.split('-').map(Number);
    const txns = await fetchFinanceTransactions(year, month);
    allFinanceTransactions.push(...txns);
    fetchedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
  }

  console.log(`Found ${allFinanceTransactions.length} total transactions (${fetchedMonths.join(', ')})\n`);

  // Find Amazon transactions missing merchant_name (item descriptions)
  const needingNames = findAmazonNeedingNames(allFinanceTransactions);
  const { charges: financeCharges, refunds: financeRefunds } = separateByType(needingNames);

  console.log(`Found ${needingNames.length} Amazon transactions needing item names:`);
  console.log(`  - ${financeCharges.length} charges`);
  console.log(`  - ${financeRefunds.length} refunds\n`);

  if (needingNames.length === 0) {
    console.log('All Amazon transactions have item names!');
    return;
  }

  const matches = [];
  let farGap = 0;

  // Run greedy assignment per type, emit rows + collect matches.
  const sections = [
    { label: 'CHARGES', fin: financeCharges, amz: amazon.charges, type: 'charge', sign: '$' },
    { label: 'REFUNDS', fin: financeRefunds, amz: amazon.refunds, type: 'refund', sign: '-$' },
  ];

  for (const sec of sections) {
    if (sec.fin.length === 0) continue;
    console.log('\n' + '='.repeat(80));
    console.log(`${sec.label}:`);
    console.log('='.repeat(80));

    for (const { ft, match, gapDays } of assignMatches(sec.fin, sec.amz)) {
      const amt = Math.abs(ft.amount).toFixed(2);
      const fday = ft.transacted_at.split('T')[0];
      if (!match) {
        console.log(`\n❌ Finance ID: ${ft.id} - ${sec.sign}${amt} on ${fday}`);
        console.log(`   No available Amazon ${sec.type} of this amount`);
        continue;
      }
      matches.push({
        financeId: ft.id,
        financeAmount: ft.amount,
        financeDate: ft.transacted_at,
        amazonOrderId: match.order_id,
        amazonDate: match.date,
        amazonMerchant: match.merchant,
        dayGap: gapDays,
        type: sec.type,
      });
      const flag = gapDays > SOFT_WINDOW_DAYS ? ` ⚠ ${gapDays}d gap — verify` : '';
      if (gapDays > SOFT_WINDOW_DAYS) farGap++;
      console.log(`\n✅ Finance ID: ${ft.id}`);
      console.log(`   Amount: ${sec.sign}${amt} | Date: ${fday}`);
      console.log(`   → Order: ${match.order_id} on ${match.date}${flag}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nTotal matches: ${matches.length}/${needingNames.length}` +
    (farGap ? `  (${farGap} matched on a >${SOFT_WINDOW_DAYS}d date gap — eyeball those)` : ''));

  // Save matches to file for reference
  fs.writeFileSync('./amazon_matches.json', JSON.stringify(matches, null, 2));
  console.log('\nMatches saved to amazon_matches.json');
  console.log('\nNext steps:');
  console.log('  1. Run: node lookup-orders.mjs     # Get item details');
  console.log('  2. Add mappings to update-amazon-transactions.mjs');
  console.log('  3. Run: node update-amazon-transactions.mjs');
}

export { assignMatches };

// Run the full pipeline only when invoked directly (keeps assignMatches
// importable for tests without executing main()).
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
