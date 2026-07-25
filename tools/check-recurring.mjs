import { FinanceAPI } from './finance-api.mjs';
const api = new FinanceAPI();

const recurring = [
  { name: 'Spotify', searches: ['Spotify'] },
  { name: 'T-Mobile', searches: ['TMOBILE', 'T-Mobile'] },
  { name: 'Fawakih', searches: ['Fawakih'] },
  { name: 'Robinhood', searches: ['Robinhood'] },
  { name: 'SoCal Gas', searches: ['Socal Gas', 'SO CAL'] },
  { name: 'Replit', searches: ['Replit'] },
  { name: 'Peacock', searches: ['Peacock'] },
  { name: 'Zaytuna', searches: ['Zaytuna'] },
  { name: 'Roots Community', searches: ['Roots'] },
  { name: 'Kindle Unlimited', searches: ['Kindle Unlimited'] },
  { name: 'Ralphs', searches: ['Ralphs'] },
  { name: 'Uber Eats', searches: ['Uber Eats'] },
  { name: 'Gardener', searches: ['Gardener'] },
  { name: 'Cleaning Lady', searches: ['Cleaning Lady', 'Victoria Vasquez'] },
];

console.log('Recurring transactions: last 3 months pattern\n');
console.log(`${'Merchant'.padEnd(20)}${'Jan'.padStart(12)}${'Feb'.padStart(12)}${'Mar'.padStart(12)}${'Apr'.padStart(12)}`);
console.log('─'.repeat(68));

for (const r of recurring) {
  const cells = ['—', '—', '—', '—'];
  for (let mi = 0; mi < 4; mi++) {
    const m = mi + 1;
    const txns = await api.list({ year: 2026, month: m, showHidden: false });
    let found = null;
    for (const t of txns) {
      const name = (t.merchant_name || t.plaid_name || '').toLowerCase();
      for (const s of r.searches) {
        if (name.includes(s.toLowerCase())) { found = t; break; }
      }
      if (found) break;
    }
    cells[mi] = found ? '$' + Math.abs(found.amount).toFixed(0) : '—';
  }
  console.log(`${r.name.padEnd(20)}${cells.map(c => c.padStart(12)).join('')}`);
}
