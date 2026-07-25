#!/usr/bin/env node
// audit-month.mjs — end-of-runbook quality pass
// Usage: node audit-month.mjs YYYY MM
import { FinanceAPI } from './finance-api.mjs';

const api = new FinanceAPI();
const [year, month] = [+process.argv[2], +process.argv[3]];
if (!year || !month) {
  console.error('Usage: node audit-month.mjs YYYY MM');
  process.exit(1);
}

const all = await api.list({ year, month });
const visible = all.filter((t) => !t.hidden);

console.log(`\n=== AUDIT: ${year}-${String(month).padStart(2, '0')} ===`);
console.log(`Total: ${all.length} (visible: ${visible.length}, hidden: ${all.length - visible.length})\n`);

// 1. Visible txns missing category
const noCat = visible.filter((t) => !t.category);
console.log(`1. Visible no-category: ${noCat.length}`);
noCat.forEach((t) =>
  console.log(`   ${t.id}: $${t.amount} | ${t.transacted_at.slice(0, 10)} | ${t.merchant_name || t.plaid_name}`)
);

// 2. Visible txns with no merchant_name
const noName = visible.filter((t) => !t.merchant_name);
console.log(`\n2. No merchant_name: ${noName.length}`);
noName.forEach((t) =>
  console.log(`   ${t.id}: $${t.amount} | "${t.plaid_name}" → ${t.category}`)
);

// 3. Raw-looking merchant names (still has state suffix, store#, run-together strings)
const rawish = visible.filter((t) => {
  const n = t.merchant_name || '';
  if (!n) return false;
  if (/[A-Z]{2}$/.test(n.trim())) return true;
  if (/#\d+\s*[A-Za-z]/.test(n)) return true;
  if (/[a-z][A-Z]/.test(n) && n.length > 15) return true;
  return false;
});
console.log(`\n3. Raw-looking merchant names: ${rawish.length}`);
rawish.forEach((t) => console.log(`   ${t.id}: "${t.merchant_name}" → ${t.category}`));

// 4. Auto-cat suspicious patterns
const suspicious = visible.filter((t) => {
  const n = (t.plaid_name || '').toUpperCase();
  if (/HOMEDEPOT/.test(n) && !['Home', 'Asif Family', 'Asif Parents'].includes(t.category)) return true;
  if (/WALMART/.test(n) && !['Home', 'Groceries', 'Hafsa', 'Yusuf + Musa', 'Sulaiman', 'Dues & Subscriptions'].includes(t.category)) return true;
  if (/COSTCO/.test(n) && Math.abs(t.amount) >= 500 && t.category === 'Groceries') return true;
  if (/COFFEE/.test(n) && t.category === 'Groceries') return true;
  return false;
});
console.log(`\n4. Auto-cat suspicious: ${suspicious.length}`);
suspicious.forEach((t) =>
  console.log(`   ${t.id}: $${t.amount} | ${t.plaid_name} → ${t.category}`)
);

// 5. Big-ticket ≥ $500 visible
const big = visible
  .filter((t) => Math.abs(t.amount) >= 500)
  .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
console.log(`\n5. Big-ticket ≥$500 (${big.length}):`);
big.forEach((t) =>
  console.log(`   $${t.amount} | ${t.transacted_at.slice(0, 10)} | ${t.merchant_name || t.plaid_name} → ${t.category}`)
);

// 6. Refunds — verify negative signs
const negs = visible.filter((t) => t.amount < 0);
console.log(`\n6. Visible refunds (${negs.length}):`);
negs.forEach((t) =>
  console.log(`   $${t.amount} | ${t.transacted_at.slice(0, 10)} | ${t.merchant_name || t.plaid_name} → ${t.category}`)
);

// 7. Possible dupes (same source+amount within 2 days)
const sortedByDate = [...visible].sort((a, b) => a.transacted_at.localeCompare(b.transacted_at));
const dupes = [];
for (let i = 0; i < sortedByDate.length; i++) {
  for (let j = i + 1; j < sortedByDate.length; j++) {
    const a = sortedByDate[i];
    const b = sortedByDate[j];
    const dayDiff = Math.abs(new Date(a.transacted_at) - new Date(b.transacted_at)) / (1000 * 60 * 60 * 24);
    if (dayDiff > 2) break;
    if (a.source === b.source && Math.abs(a.amount - b.amount) < 0.01 && a.id !== b.id) {
      dupes.push([a, b]);
    }
  }
}
console.log(`\n7. Possible dupes (same source+amount within 2 days): ${dupes.length}`);
dupes.forEach(([a, b]) =>
  console.log(
    `   ${a.id}/${b.id}: $${a.amount} | ${a.transacted_at.slice(0, 10)} & ${b.transacted_at.slice(0, 10)} | ${a.merchant_name || a.plaid_name}`
  )
);

// 8. Amazon placeholders (Unknown Item)
const placeholders = visible.filter((t) => /Amazon - Unknown/.test(t.merchant_name || ''));
console.log(`\n8. Amazon "Unknown Item" placeholders: ${placeholders.length}`);
placeholders.forEach((t) =>
  console.log(`   ${t.id}: $${t.amount} | ${t.transacted_at.slice(0, 10)} | "${t.merchant_name}" → ${t.category}`)
);

console.log('\n=== AUDIT DONE ===\n');
