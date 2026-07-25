/**
 * Finance Tracker API SDK
 *
 * SDK for interacting with the Jarvis Finance Tracker API.
 * Handles the API's quirks (like requiring all fields on update).
 *
 * Quick Start:
 *   import { FinanceAPI } from './finance-api.mjs';
 *   const api = new FinanceAPI();
 *
 *   // List transactions
 *   const txns = await api.list({ year: 2025, month: 12 });
 *
 *   // Safe update (preserves existing fields)
 *   await api.update(12345, { category: 'Groceries' });
 *
 *   // Bulk categorize
 *   await api.categorizeMany([12345, 12346], 'Paris Trip');
 */

const API_BASE_URL = 'https://sifxtre.me/api';
// Auth = the same Google-issued JWT the web app uses. Copy your token from
// finances.sifxtre.me (Google login) and set JARVIS_TOKEN. Sent as a Bearer header.
const TOKEN = process.env.JARVIS_TOKEN;

// Transactions matching these patterns are always auto-hidden (credit card payments, internal transfers, etc.)
const HIDE_RULES = [
  /autopay.*payment.*thank you/i,
  /superpower\.com/i,
  /mobile payment.*thank you/i,
  /payment thank you.*mobile/i,
];

// Common category rules for auto-categorization
// Categories must match actual categories in the finance tracker
const CATEGORY_RULES = [
  { pattern: /costco|trader joe|whole foods|sprouts|ralphs|vons|safeway|grocery|kroger/i, category: 'Groceries' },
  { pattern: /restaurant|cafe|coffee|starbucks|dunkin|mcdonald|chipotle|panera|chick-fil|subway|pizza|taco|burger|wendy|in-n-out|panda express|doordash|grubhub|sushi|thai|indian|mediterranean/i, category: 'Eating Out' },
  { pattern: /shell|chevron|exxon|mobil|arco|76 |fuel|petroleum/i, category: 'Gas' },
  { pattern: /netflix|spotify|hulu|disney\+|hbo|apple music|youtube premium|audible|kindle|prime video|apple\.com\/bill|wmt plus/i, category: 'Dues & Subscriptions' },
  { pattern: /parking|meter/i, category: 'Parking' },
  { pattern: /home depot|lowes|ikea|bed bath/i, category: 'Home' },
  { pattern: /cvs|walgreens|pharmacy|drug|vitamin|supplement/i, category: 'Personal Care' },
  { pattern: /toy|lego|nintendo|playstation|xbox|game/i, category: 'Yusuf + Musa' },
  { pattern: /diaper|pampers|huggies|baby|formula|infant/i, category: 'Sulaiman' },
  { pattern: /charity|donation|islamic relief|mosque|masjid|cair/i, category: 'Charity' },
  { pattern: /zakat/i, category: 'Zakat' },
  { pattern: /state farm|geico|allstate|progressive.*insurance/i, category: 'Car Insurance' },
  { pattern: /t-mobile|tmobile|verizon|at&t|sprint/i, category: 'Cellphone' },
  { pattern: /tesla supercharger/i, category: 'Tesla' },
  { pattern: /regal|amc|cinemark|edwards.*cinema|movie/i, category: 'Fun' },
  { pattern: /amazon|amzn/i, category: 'Home' }, // Default Amazon to Home, pipeline will refine
  { pattern: /walmart\+|walmart\.com w\+/i, category: 'Dues & Subscriptions' },
  { pattern: /orange crescent sch|nbs\*orange crescent/i, category: 'Tuition' },
  { pattern: /boba guys/i, category: 'Eating Out' },
  { pattern: /kabob master/i, category: 'Eating Out' },
  { pattern: /delta air lines/i, category: 'Asif Family' },
];

export class FinanceAPI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || API_BASE_URL;
    this.token = options.token || TOKEN;
    if (!this.token) throw new Error('JARVIS_TOKEN is required — copy your API token from finances.sifxtre.me (Google login) into JARVIS_TOKEN.');
    this._cache = new Map();
  }

  // ============ Core Request Method ============

  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${method} ${path} failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  // ============ List / Get ============

  /**
   * List transactions with optional filters
   * @param {Object} params
   * @param {number} params.year - Filter by year
   * @param {number} params.month - Filter by month (1-12)
   * @param {boolean} params.showHidden - Include hidden transactions
   * @param {boolean} params.includeRawData - Include raw_data field
   * @returns {Promise<Array>} Transactions
   */
  async list(params = {}) {
    const query = new URLSearchParams();
    if (params.year) query.set('year', params.year);
    if (params.month) query.set('month', params.month);
    if (params.showHidden === true) query.set('show_hidden', 'true');
    else if (params.showHidden === false) query.set('show_hidden', 'false');
    if (params.includeRawData) query.set('include_raw_data', 'true');

    const path = `/financial_transactions?${query.toString()}`;
    const data = await this._request('GET', path);
    return data.results || data;
  }

  // Alias for backwards compatibility
  async listTransactions(params = {}) {
    return this.list({
      year: params.year,
      month: params.month,
      showHidden: params.show_hidden,
      includeRawData: params.include_raw_data
    });
  }

  /**
   * Get a single transaction by ID
   */
  async get(id) {
    try {
      return await this._request('GET', `/financial_transactions/${id}`);
    } catch (e) {
      return null;
    }
  }

  // Alias
  async getTransaction(id) {
    return this.get(id);
  }

  // ============ Create ============

  /**
   * Create a new transaction
   */
  async create(transaction) {
    const body = {
      merchant_name: transaction.merchant_name,
      category: transaction.category,
      amount: transaction.amount,
      transacted_at: transaction.transacted_at,
      source: transaction.source || 'bofa',
      hidden: transaction.hidden || false
    };
    // external_id is the generic external transaction id (a Plaid/Teller id, or a
    // csv:<source>:... synthetic id for CSV rows) so re-dropping a statement is idempotent.
    if (transaction.external_id) body.external_id = transaction.external_id;
    return this._request('POST', '/financial_transactions', body);
  }

  // Alias
  async createTransaction(transaction) {
    return this.create(transaction);
  }

  /**
   * Create multiple transactions
   */
  async createMany(transactions) {
    const results = [];
    for (const txn of transactions) {
      results.push(await this.create(txn));
    }
    return results;
  }

  // Alias
  async createTransactions(transactions) {
    return this.createMany(transactions);
  }

  // ============ Update (SAFE - fetches existing first) ============

  /**
   * Update a transaction SAFELY by fetching existing data first.
   * This prevents the API bug where missing fields get set to null.
   *
   * @param {number} id - Transaction ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated transaction
   */
  async update(id, updates) {
    // Fetch existing transaction to preserve fields
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Transaction ${id} not found`);
    }

    // Get correct values, preferring raw_data for corrupted records
    const amount = updates.amount ?? existing.amount ??
      (existing.raw_data?.amount ? parseFloat(existing.raw_data.amount) : null);
    const date = updates.transacted_at ??
      existing.raw_data?.date ??
      existing.transacted_at?.split('T')[0];
    const source = updates.source ?? existing.source ?? 'amex';

    // Merge updates with existing
    const merged = {
      merchant_name: updates.merchant_name ?? existing.merchant_name,
      category: updates.category ?? existing.category,
      amount: amount,
      transacted_at: date,
      source: source,
      hidden: updates.hidden ?? existing.hidden ?? false
    };

    return this._request('PUT', `/financial_transactions/${id}`, merged);
  }

  // Alias
  async updateTransaction(id, updates) {
    return this.update(id, updates);
  }

  /**
   * Update multiple transactions with the same updates
   */
  async updateMany(ids, updates) {
    const results = [];
    for (const id of ids) {
      results.push(await this.update(id, updates));
    }
    return results;
  }

  /**
   * Categorize multiple transactions
   */
  async categorizeMany(ids, category) {
    return this.updateMany(ids, { category });
  }

  // ============ Delete ============

  async delete(id) {
    return this._request('DELETE', `/financial_transactions/${id}`);
  }

  async deleteTransaction(id) {
    return this.delete(id);
  }

  // ============ Query Helpers ============

  /**
   * Find uncategorized transactions
   */
  async findUncategorized(params = {}) {
    const txns = await this.list({ ...params, includeRawData: true });
    return txns.filter(t => !t.category && !t.hidden);
  }

  /**
   * Find uncategorized Amazon transactions
   */
  async findUncategorizedAmazon(params = {}) {
    const txns = await this.findUncategorized(params);
    return txns.filter(t => {
      const name = (t.plaid_name || '').toLowerCase();
      return (name.includes('amazon') || name.includes('amzn')) && !name.includes('aws');
    });
  }

  /**
   * Find transactions by pattern
   */
  async findByPattern(pattern, params = {}) {
    const txns = await this.list(params);
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return txns.filter(t => {
      const name = (t.plaid_name || t.merchant_name || '').toLowerCase();
      return regex.test(name);
    });
  }

  /**
   * Find transactions in a date range
   */
  async findByDateRange(startDate, endDate, params = {}) {
    const txns = await this.list({ ...params, includeRawData: true });
    return txns.filter(t => {
      const date = t.raw_data?.date || t.transacted_at?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
  }

  // ============ Auto-Categorization ============

  /**
   * Auto-categorize uncategorized transactions using rules
   * @param {Object} params - List params (year, month)
   * @param {boolean} dryRun - If true, don't actually update
   * @returns {Promise<Array>} Categorized transactions
   */
  async autoCategorize(params = {}, dryRun = false) {
    const uncategorized = await this.findUncategorized(params);
    const results = [];

    for (const t of uncategorized) {
      const name = (t.plaid_name || t.merchant_name || '').toLowerCase();

      // Check hide rules first — auto-hide credit card payments, internal transfers, etc.
      const shouldHide = HIDE_RULES.some(rule => rule.test(name));
      if (shouldHide) {
        if (!dryRun) {
          await this.update(t.id, { hidden: true });
        }
        results.push({ id: t.id, name: t.plaid_name, category: '(hidden)' });
        continue;
      }

      for (const rule of CATEGORY_RULES) {
        if (rule.pattern.test(name)) {
          if (!dryRun) {
            await this.update(t.id, { category: rule.category });
          }
          results.push({ id: t.id, name: t.plaid_name, category: rule.category });
          break;
        }
      }
    }

    return results;
  }

  /**
   * Categorize a trip (by date range and location patterns)
   */
  async categorizeTrip(tripName, startDate, endDate, locationPatterns = []) {
    const txns = await this.findByDateRange(startDate, endDate, { year: 2025, includeRawData: true });

    const tripTxns = txns.filter(t => {
      const name = (t.plaid_name || '').toUpperCase();
      // Include if matches location pattern or is Uber during trip
      const matchesLocation = locationPatterns.some(p => name.includes(p.toUpperCase()));
      const isUber = name.includes('UBER');
      return matchesLocation || isUber;
    });

    let total = 0;
    for (const t of tripTxns) {
      await this.update(t.id, { category: tripName });
      total += Math.abs(t.amount || parseFloat(t.raw_data?.amount) || 0);
    }

    return { count: tripTxns.length, total };
  }

  // ============ Budgets ============

  /**
   * Get all budgets from the API
   */
  async budgets() {
    return this._request('GET', '/budgets');
  }

  // ============ Analysis ============

  /**
   * Get spending summary by category
   */
  async summary(params = {}) {
    // Fetch non-hidden transactions — the API handles amortization when year+month are provided
    const txns = await this.list({ ...params, showHidden: false });

    const byCategory = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of txns) {
      const category = t.category || 'Uncategorized';
      const amount = t.amount || 0;
      const isIncome = category.toLowerCase().includes('income');

      if (!byCategory[category]) {
        byCategory[category] = { total: 0, count: 0 };
      }

      byCategory[category].total += amount;
      byCategory[category].count++;

      if (isIncome) {
        totalIncome += Math.abs(amount);
      } else {
        // Include refunds (negative amounts) — they offset expenses, matching the UI
        totalExpenses += amount;
      }
    }

    return { byCategory, totalIncome, totalExpenses, netCashFlow: totalIncome - totalExpenses };
  }

  // Alias
  async getSpendingSummary(params = {}) {
    return this.summary(params);
  }

  /**
   * Find recurring transactions missing in a month
   */
  async findMissingRecurring(params = {}) {
    const year = params.year || new Date().getFullYear();
    const month = params.month || new Date().getMonth() + 1;
    const minOccurrences = params.minOccurrences || 3;

    const txns = await this.list({ year, showHidden: false });

    const byMerchant = {};
    for (const t of txns) {
      const key = t.merchant_name || t.plaid_name;
      if (!key) continue;

      if (!byMerchant[key]) {
        byMerchant[key] = { merchant: key, category: t.category, source: t.source, months: new Set(), amounts: [] };
      }
      byMerchant[key].months.add(new Date(t.transacted_at).getMonth() + 1);
      byMerchant[key].amounts.push(t.amount);
    }

    return Object.values(byMerchant)
      .filter(d => d.months.size >= minOccurrences && !d.months.has(month))
      .map(d => ({
        merchant: d.merchant,
        category: d.category,
        source: d.source,
        monthCount: d.months.size,
        typicalAmount: d.amounts[d.amounts.length - 1]
      }))
      .sort((a, b) => b.monthCount - a.monthCount);
  }

  // Alias
  async findMissingWithDays(params = {}) {
    return this.findMissingRecurring(params);
  }

  /**
   * Find transactions that need review: no category OR no/raw merchant name.
   * This is the combined "needs attention" check — surfaces everything
   * a human should look at for a given month.
   */
  async findNeedsReview(params = {}) {
    const txns = await this.list({ ...params, includeRawData: true });

    return txns.filter(t => {
      if (t.hidden) return false;

      // No category = needs review
      if (!t.category) return true;

      // Has category but missing/raw merchant name = also needs review
      if (!t.merchant_name) return true;

      const raw = t.merchant_name;
      if (raw.includes('*') || raw.includes('#')) return true;
      if (raw.match(/\s[A-Z]{2}$/)) return true;
      if (raw.match(/AMZN|AMAZON\.COM/i) && !raw.startsWith('Amazon -')) return true;
      if (raw.match(/^[A-Z0-9\s\-\.]+$/) && raw.length > 20) return true;

      return false;
    }).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }

  /**
   * Find transactions with missing or raw Plaid-style merchant names
   * These need human-readable names for better tracking
   */
  async findMissingMerchantNames(params = {}) {
    const txns = await this.list({ ...params, includeRawData: true });

    return txns.filter(t => {
      if (t.hidden) return false;

      // Empty merchant name
      if (!t.merchant_name) return true;

      const raw = t.merchant_name;

      // Patterns that indicate raw Plaid names:
      // - Contains asterisks or hash signs (SQ *, TST*)
      // - Ends with state code like " CA", " AR", " WA"
      // - Amazon without proper prefix
      // - All uppercase with numbers and length > 20
      if (raw.includes('*') || raw.includes('#')) return true;
      if (raw.match(/\s[A-Z]{2}$/)) return true;
      if (raw.match(/AMZN|AMAZON\.COM/i) && !raw.startsWith('Amazon -')) return true;
      if (raw.match(/^[A-Z0-9\s\-\.]+$/) && raw.length > 20) return true;

      return false;
    }).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)); // Higher value first
  }
}

// ============ CLI ============

async function cli() {
  const api = new FinanceAPI();
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'list': {
      const [year, month] = args;
      const txns = await api.list({ year: year || 2025, month });
      console.log(`Found ${txns.length} transactions`);
      txns.slice(0, 10).forEach(t => {
        console.log(`  ${t.id}: ${(t.merchant_name || t.plaid_name || '').substring(0, 40)} | $${t.amount} | ${t.category || 'UNCATEGORIZED'}`);
      });
      if (txns.length > 10) console.log(`  ... and ${txns.length - 10} more`);
      break;
    }

    case 'uncategorized': {
      const [year, month] = args;
      const txns = await api.findUncategorized({ year: year || 2025, month });
      console.log(`Found ${txns.length} uncategorized:\n`);
      txns.forEach(t => {
        console.log(`${t.id}: ${(t.plaid_name || '').substring(0, 50)} | $${t.amount}`);
      });
      break;
    }

    case 'uncategorized-amazon': {
      const [year] = args;
      const txns = await api.findUncategorizedAmazon({ year: year || 2025 });
      console.log(`Found ${txns.length} uncategorized Amazon transactions`);
      txns.forEach(t => console.log(`  ${t.id}: $${t.amount} on ${t.transacted_at?.split('T')[0]}`));
      break;
    }

    case 'auto-categorize': {
      const [year, month, dryRunFlag] = args;
      const dryRun = dryRunFlag === '--dry-run';
      const results = await api.autoCategorize({ year: year || 2025, month }, dryRun);
      console.log(`${dryRun ? '[DRY RUN] Would categorize' : 'Categorized'} ${results.length} transactions:\n`);
      results.forEach(r => console.log(`  ${r.id}: ${r.name?.substring(0, 40)} → ${r.category}`));
      break;
    }

    case 'summary': {
      const [year, month] = args;
      const s = await api.summary({ year: year || 2025, month: month || new Date().getMonth() + 1 });
      console.log(`\nSummary for ${year || 2025}-${month || new Date().getMonth() + 1}:`);
      console.log(`  Income: $${s.totalIncome.toFixed(2)}`);
      console.log(`  Expenses: $${s.totalExpenses.toFixed(2)}`);
      console.log(`  Net: $${s.netCashFlow.toFixed(2)}`);
      console.log(`\nBy Category:`);
      Object.entries(s.byCategory)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 15)
        .forEach(([cat, data]) => console.log(`  ${cat}: $${data.total.toFixed(2)} (${data.count} txns)`));
      break;
    }

    case 'budgets': {
      const budgets = await api.budgets();
      if (args.includes('--json')) {
        console.log(JSON.stringify(budgets));
      } else {
        console.log('\nMonthly Budgets:');
        const expenses = budgets.filter(b => b.expense_type === 'expense')
          .sort((a, b) => a.display_order - b.display_order);
        const income = budgets.filter(b => b.expense_type === 'income')
          .sort((a, b) => a.display_order - b.display_order);
        if (income.length) {
          console.log('\n  Income:');
          income.forEach(b => console.log(`    ${b.name}: $${b.amount.toFixed(0)}`));
        }
        console.log('\n  Expenses:');
        expenses.forEach(b => console.log(`    ${b.name}: $${b.amount.toFixed(0)}`));
        const totalBudget = expenses.reduce((s, b) => s + b.amount, 0);
        console.log(`\n  Total Expense Budget: $${totalBudget.toFixed(0)}`);
      }
      break;
    }

    case 'missing':
    case 'missing-days': {
      const [month] = args;
      const missing = await api.findMissingRecurring({ month: parseInt(month) || new Date().getMonth() + 1 });
      console.log(`Missing recurring transactions:`);
      missing.forEach(m => console.log(`  ${m.merchant} | ${m.source} | ${m.monthCount} months | $${m.typicalAmount}`));
      break;
    }

    case 'categorize': {
      // node finance-api.mjs categorize <category> <id1> [id2] [id3] ...
      const [category, ...ids] = args;
      if (!category || ids.length === 0) {
        console.log('Usage: node finance-api.mjs categorize <category> <id1> [id2] ...');
        console.log('Example: node finance-api.mjs categorize "Eating Out" 18662 18663');
        break;
      }
      const numericIds = ids.map(id => parseInt(id));
      console.log(`Categorizing ${numericIds.length} transactions as "${category}"...`);
      await api.categorizeMany(numericIds, category);
      console.log(`✅ Done`);
      break;
    }

    case 'update': {
      // node finance-api.mjs update <id> <field>=<value> [field2=value2] ...
      const [id, ...updates] = args;
      if (!id || updates.length === 0) {
        console.log('Usage: node finance-api.mjs update <id> <field>=<value> ...');
        console.log('Example: node finance-api.mjs update 18662 category="Eating Out" merchant_name="Restaurant"');
        break;
      }
      const updateObj = {};
      for (const u of updates) {
        const [key, ...valueParts] = u.split('=');
        updateObj[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
      console.log(`Updating transaction ${id}:`, updateObj);
      await api.update(parseInt(id), updateObj);
      console.log(`✅ Done`);
      break;
    }

    case 'get': {
      const [id] = args;
      if (!id) {
        console.log('Usage: node finance-api.mjs get <id>');
        break;
      }
      const txn = await api.get(parseInt(id));
      if (txn) {
        console.log(JSON.stringify(txn, null, 2));
      } else {
        console.log(`Transaction ${id} not found`);
      }
      break;
    }

    case 'search': {
      // node finance-api.mjs search <pattern> [year|all] [month]
      const [pattern, year, month] = args;
      if (!pattern) {
        console.log('Usage: node finance-api.mjs search <pattern> [year|all] [month]');
        console.log('Examples:');
        console.log('  node finance-api.mjs search "uber" 2026 1    # Search specific month');
        console.log('  node finance-api.mjs search "uber" 2026      # Search entire year');
        console.log('  node finance-api.mjs search "uber" all       # Search all years');
        console.log('  node finance-api.mjs search "uber"          # Search current month only');
        break;
      }

      if (year === 'all') {
        // Search all years (2019-current)
        const currentYear = new Date().getFullYear();
        const allTxns = [];
        for (let y = 2019; y <= currentYear; y++) {
          const yearTxns = await api.findByPattern(pattern, { year: y });
          allTxns.push(...yearTxns);
        }
        console.log(`Found ${allTxns.length} matching "${pattern}" (all time):\n`);
        // Sort by date descending (most recent first)
        allTxns.sort((a, b) => new Date(b.transacted_at) - new Date(a.transacted_at));
        allTxns.forEach(t => {
          const date = t.transacted_at ? t.transacted_at.split('T')[0] : 'unknown';
          console.log(`  ${t.id}: ${date} | ${(t.merchant_name || t.plaid_name || '').substring(0, 35)} | $${t.amount} | ${t.category || 'UNCATEGORIZED'}`);
        });
      } else {
        // Original year/month logic
        let searchParams = {};
        if (year) {
          searchParams.year = parseInt(year);
          if (month) {
            searchParams.month = parseInt(month);
          }
          // If year provided but no month, search entire year by omitting month parameter
        } else {
          // No year provided - search current year/month only (original behavior)
          searchParams.year = new Date().getFullYear();
          searchParams.month = new Date().getMonth() + 1;
        }

        const txns = await api.findByPattern(pattern, searchParams);
        const timeScope = year ? (month ? `${year}-${month}` : `all of ${year}`) : 'current month';
        console.log(`Found ${txns.length} matching "${pattern}" (${timeScope}):\n`);
        txns.forEach(t => {
          console.log(`  ${t.id}: ${(t.merchant_name || t.plaid_name || '').substring(0, 45)} | $${t.amount} | ${t.category || 'UNCATEGORIZED'}`);
        });
      }
      break;
    }

    case 'missing-names': {
      // node finance-api.mjs missing-names [year] [month]
      const [year, month] = args;
      const txns = await api.findMissingMerchantNames({
        year: year || new Date().getFullYear(),
        month: month || new Date().getMonth() + 1
      });
      if (txns.length === 0) {
        console.log('All transactions have proper merchant names!');
        break;
      }
      console.log(`Found ${txns.length} transactions needing merchant names:\n`);
      for (const t of txns) {
        console.log(`${t.id}: $${Math.abs(t.amount).toFixed(2)} | ${t.category || 'uncategorized'}`);
        console.log(`  plaid_name: ${t.plaid_name || '(none)'}`);
        console.log(`  merchant_name: ${t.merchant_name || '(empty)'}`);
        console.log(`  Tip: search prior transactions with: node finance-api.mjs search "${(t.plaid_name || '').split(' ')[0]}"`);
        console.log('');
      }
      break;
    }

    case 'needs-review': {
      // node finance-api.mjs needs-review [year] [month]
      const [year, month] = args;
      const yr = parseInt(year) || new Date().getFullYear();
      const mo = parseInt(month) || new Date().getMonth() + 1;
      const txns = await api.findNeedsReview({ year: yr, month: mo });
      if (txns.length === 0) {
        console.log('All transactions are categorized with proper merchant names!');
        break;
      }
      const noCat = txns.filter(t => !t.category);
      const noName = txns.filter(t => t.category); // Has category but still flagged = merchant name issue
      console.log(`Needs review: ${txns.length} total (${noCat.length} uncategorized, ${noName.length} missing merchant name)\n`);
      if (noCat.length > 0) {
        console.log('Uncategorized:');
        for (const t of noCat) {
          console.log(`  ${t.id}: ${(t.plaid_name || '').substring(0, 45)} | $${t.amount}`);
        }
        console.log('');
      }
      if (noName.length > 0) {
        console.log('Missing merchant name:');
        for (const t of noName) {
          console.log(`  ${t.id}: ${(t.plaid_name || t.merchant_name || '').substring(0, 45)} | $${t.amount} | ${t.category}`);
        }
      }
      break;
    }

    case 'runbook': {
      // node finance-api.mjs runbook [year] [month]
      // Runs the full monthly finance review
      const now = new Date();
      const year = parseInt(args[0]) || now.getFullYear();
      const month = parseInt(args[1]) || now.getMonth() + 1;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`FINANCE RUNBOOK: ${year}-${String(month).padStart(2, '0')}`);
      console.log(`${'='.repeat(60)}\n`);

      // Step 1: Check missing recurring
      console.log('📋 Step 1: Checking missing recurring transactions...');
      const missing = await api.findMissingRecurring({ year, month });
      if (missing.length > 0) {
        console.log(`\n⚠️  Found ${missing.length} missing recurring transactions:`);
        missing.forEach(m => console.log(`  - ${m.merchant} | ${m.source} | $${m.typicalAmount}`));
        console.log('\n[ACTION NEEDED] Add these manually or verify they are expected to be missing.\n');
      } else {
        console.log('✅ No missing recurring transactions.\n');
      }

      // Step 2: Check uncategorized Amazon (scoped to target month)
      console.log('📋 Step 2: Checking uncategorized Amazon transactions...');
      const uncatAmazon = await api.findUncategorizedAmazon({ year, month });
      if (uncatAmazon.length > 0) {
        console.log(`\n⚠️  Found ${uncatAmazon.length} uncategorized Amazon transactions:`);
        uncatAmazon.forEach(t => console.log(`  ${t.id}: $${t.amount} on ${t.transacted_at?.split('T')[0]}`));
        console.log('\n[ACTION NEEDED] Run Amazon pipeline:');
        console.log('  node scrape-amazon-transactions.mjs');
        console.log('  node match-amazon-transactions.mjs');
        console.log('  node lookup-orders.mjs');
        console.log('  # Update ORDER_MAPPINGS in update-amazon-transactions.mjs');
        console.log('  node update-amazon-transactions.mjs\n');
      } else {
        console.log('✅ No uncategorized Amazon transactions.\n');
      }

      // Step 3: Auto-categorize (dry run first)
      console.log('📋 Step 3: Auto-categorizing transactions...');
      const autoCatResults = await api.autoCategorize({ year, month }, true);
      if (autoCatResults.length > 0) {
        console.log(`  Would auto-categorize ${autoCatResults.length} transactions:`);
        autoCatResults.forEach(r => console.log(`    ${r.id}: ${r.name?.substring(0, 35)} → ${r.category}`));
        // Actually apply
        await api.autoCategorize({ year, month }, false);
        console.log(`✅ Auto-categorized ${autoCatResults.length} transactions.\n`);
      } else {
        console.log('✅ No transactions to auto-categorize.\n');
      }

      // Step 4: Check remaining uncategorized
      console.log('📋 Step 4: Checking remaining uncategorized...');
      const uncategorized = await api.findUncategorized({ year, month });
      if (uncategorized.length > 0) {
        console.log(`\n⚠️  Found ${uncategorized.length} uncategorized transactions:`);
        uncategorized.forEach(t => {
          console.log(`  ${t.id}: ${(t.plaid_name || t.merchant_name || '').substring(0, 40)} | $${t.amount}`);
        });
        console.log('\n[ACTION NEEDED] Categorize these manually. For ambiguous ones, ask the user.\n');
      } else {
        console.log('✅ All transactions categorized.\n');
      }

      // Step 5: Check missing merchant names
      console.log('📋 Step 5: Checking missing merchant names...');
      const missingNames = await api.findMissingMerchantNames({ year, month });
      if (missingNames.length > 0) {
        console.log(`\n⚠️  Found ${missingNames.length} transactions with raw/missing merchant names:`);
        for (const t of missingNames) {
          console.log(`  ${t.id}: ${t.plaid_name || '(empty)'}`);
          console.log(`    → Search history: node finance-api.mjs search "${(t.plaid_name || '').split(' ')[0]}" ${year - 1}`);
        }
        console.log('\n[ACTION NEEDED] Update merchant names using historical patterns.\n');
      } else {
        console.log('✅ All transactions have proper merchant names.\n');
      }

      // Step 6: Summary
      console.log('📋 Step 6: Monthly Summary');
      const summary = await api.summary({ year, month });
      console.log(`\n  Income:   $${summary.totalIncome.toFixed(2)}`);
      console.log(`  Expenses: $${summary.totalExpenses.toFixed(2)}`);
      console.log(`  Net:      $${summary.netCashFlow.toFixed(2)}`);
      console.log('\n  Top categories:');
      Object.entries(summary.byCategory)
        .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
        .slice(0, 10)
        .forEach(([cat, data]) => console.log(`    ${cat}: $${data.total.toFixed(2)} (${data.count} txns)`));

      console.log(`\n${'='.repeat(60)}`);
      console.log('RUNBOOK COMPLETE');
      console.log(`${'='.repeat(60)}\n`);
      break;
    }

    default:
      console.log(`
Finance Tracker SDK

Commands:
  runbook [year] [month]                      Run full monthly finance review (recommended!)
  list [year] [month]                         List transactions
  get <id>                                    Get a single transaction
  search <pattern> [year] [month]             Search by merchant name pattern
  uncategorized [year] [month]                Find all uncategorized
  uncategorized-amazon [year]                 Find uncategorized Amazon
  needs-review [year] [month]                 Find txns needing action (no category OR no merchant name)
  missing-names [year] [month]                Find transactions with raw/missing merchant names
  auto-categorize [year] [month] [--dry-run]  Auto-categorize using rules
  categorize <category> <id1> [id2] ...       Bulk categorize transactions
  update <id> <field>=<value> ...             Update transaction fields
  summary [year] [month]                      Spending summary
  budgets [--json]                            Show monthly budgets
  missing [month]                             Find missing recurring

Examples:
  node finance-api.mjs runbook                # Run for current month
  node finance-api.mjs runbook 2026 1         # Run for January 2026
  node finance-api.mjs list 2026 1
  node finance-api.mjs search "uber" 2026 1
  node finance-api.mjs update 18662 merchant_name="Walmart+"
`);
  }
}

if (process.argv[1]?.endsWith('finance-api.mjs')) {
  cli().catch(console.error);
}

export default FinanceAPI;
