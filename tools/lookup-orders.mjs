import { chromium } from 'playwright-core';
import fs from 'fs';

// --- Resilience scaffolding (mirrors scrape-amazon-transactions.mjs) ---------
// Exit: 0 ok | 2 watchdog | 3 login wall | 4 CDP connect | 1 other
const STATUS_FILE = './lookup_orders_status.json';
const HARD_DEADLINE_MS = parseInt(process.env.LOOKUP_DEADLINE_MS || '420000', 10); // 7 min
function log(msg) { fs.writeSync(1, `[${new Date().toISOString()}] ${msg}\n`); }
function setStatus(phase, extra = {}) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(
      { phase, updated_at: new Date().toISOString(), pid: process.pid, ...extra }, null, 2));
  } catch { /* best-effort */ }
}
function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms); }),
  ]).finally(() => clearTimeout(t));
}
async function isLoginWall(page) {
  try {
    const u = (page.url() || '').toLowerCase();
    if (u.includes('/ap/signin') || u.includes('/ap/mfa') || u.includes('signin?')) return true;
    return /sign-?in/i.test(await page.title());
  } catch { return false; }
}

// Category keywords based on CATEGORIZATION_RULES.md
const CATEGORY_RULES = {
  'Sulaiman': [
    'diaper', 'pampers', 'huggies', 'sippy cup', 'sleep sack', 'car seat',
    'baby food', 'baby pouch', 'toddler', 'potty', 'training seat',
    'baby blanket', 'iron supplement', 'baby wash', 'baby soap', 'baby lotion',
    'size 5', 'size 4', 'size 6', // diaper sizes
  ],
  'Yusuf + Musa': [
    'school', 'underwear', 'swim', 'jujitsu', 'gi ', 'costume', 'electronics kit',
    'ramadan', 'hoodie', 'wetsuit', 'backpack', 'lunchbox', 'kids book',
    'graphic novel', 'dog man', 'wings of fire', 'captain underpants',
    'badminton', 'racket', 'sports', 'boys', "boy's", "boy's", 'children',
  ],
  'Hafsa': [
    'planner', 'dress', 'shalwar', 'kamiz', 'sports bra', 'swimsuit', 'henna',
    'women', "women's", "women's", 'cook book', 'cookbook', 'hijab', 'abaya',
  ],
  'Asif': [
    'lego', 'mental models', 'coding interview', 'programming',
    "men's jeans", "men's jeans", "men's shorts", "men's shorts",  // both apostrophe types
    'levi', 'developer', 'software', '7 habits', 'self-help',
    'productivity', 'leadership',
  ],
  'Asif Career': [
    'standing desk', 'desk', 'monitor', 'keyboard', 'mouse', 'webcam',
    'headset', 'office chair', 'laptop stand', 'usb hub', 'cable',
    'walking pad', 'treadmill', 'under desk',
  ],
  'Asif Family': [
    'thermostat', 'beard trimmer', 'homeopathic', 'magnesium', 'family',
  ],
  'Gifts': [
    'birthday', 'eid', 'present', 'gift', 'wrapping',
  ],
  'Home': [
    'filter', 'cleaner', 'detergent', 'vacuum', 'soap', 'sponge', 'mop',
    'trash', 'curtain', 'frame', 'light', 'washer', 'dryer', 'kitchen',
    'spoon', 'fork', 'knife', 'utensil', 'pan', 'pot', 'bowl', 'plate',
    'towel', 'rug', 'mat', 'shower', 'bathroom', 'laundry', 'dishwasher',
    'clorox', 'lysol', 'wipe', 'paper towel', 'tissue', 'toilet paper',
    'air freshener', 'candle', 'storage', 'organizer', 'bin', 'basket',
    'hanger', 'hook', 'shelf', 'rack', 'stainless steel',
  ],
  'Personal Care': [
    'toothbrush', 'toothpaste', 'lotion', 'sunscreen', 'razor', 'electrolyte',
    'lmnt', 'nuun', 'stepper', 'exercise', 'yoga', 'fitness', 'workout',
    'shampoo', 'conditioner', 'body wash', 'deodorant', 'floss', 'mouthwash',
    'vitamin', 'supplement', 'exercise ball', 'resistance band', 'dumbbell',
  ],
  'Groceries': [
    'fresh', 'cashew butter', 'fruit snacks', 'salt', 'kosher salt', 'spice',
    'olive oil', 'coconut oil', 'honey', 'maple syrup', 'almond', 'nuts',
    'snack', 'food', 'organic', 'cereal', 'oatmeal', 'rice', 'pasta',
  ],
  'Subscriptions': [
    'prime video', 'ad free', 'subscription', 'membership', 'kindle unlimited',
    'audible', 'amazon music',
  ],
  'Travel and Trips': [
    'cooler', 'camping', 'sleeping pad', 'tent', 'backpacking', 'luggage',
    'suitcase', 'travel', 'portable',
  ],
  'Car Maintenance': [
    'tire', 'license plate', 'car buffer', 'car wash', 'windshield', 'wiper',
    'motor oil', 'automotive', 'car seat cover', 'car charger',
  ],
};

// Suggest a category based on item name
function suggestCategory(itemName) {
  const lowerItem = itemName.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    for (const keyword of keywords) {
      if (lowerItem.includes(keyword.toLowerCase())) {
        return { category, matchedKeyword: keyword };
      }
    }
  }

  return null;
}

// Create a short merchant name from item description
function createMerchantName(itemName) {
  // Take first ~40 chars and clean up
  let short = itemName.slice(0, 50);

  // Cut at natural break points
  const breakPoints = [' - ', ', ', ' | ', ' ('];
  for (const bp of breakPoints) {
    const idx = short.indexOf(bp);
    if (idx > 10) {
      short = short.slice(0, idx);
      break;
    }
  }

  // Trim and add Amazon prefix
  short = short.trim();
  if (short.length > 40) {
    short = short.slice(0, 37) + '...';
  }

  return `Amazon - ${short}`;
}

// Load order IDs from amazon_matches.json (output of match-amazon-transactions.mjs)
let ORDER_IDS = [];
let MATCHES = [];

if (fs.existsSync('./amazon_matches.json')) {
  MATCHES = JSON.parse(fs.readFileSync('./amazon_matches.json', 'utf8'));
  ORDER_IDS = MATCHES
    .filter(m => m.amazonOrderId)
    .map(m => m.amazonOrderId);
  console.log(`Loaded ${ORDER_IDS.length} order IDs from amazon_matches.json`);
} else {
  console.error('amazon_matches.json not found. Run match-amazon-transactions.mjs first.');
  process.exit(1);
}

async function lookupOrder(page, orderId) {
  const url = `https://www.amazon.com/gp/your-account/order-details?orderID=${orderId}`;
  log(`Looking up: ${orderId}`);

  try {
    await withTimeout(
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }),
      35000, `goto ${orderId}`);
    await page.waitForTimeout(2000);

    if (await isLoginWall(page)) return { orderId, error: 'LOGIN_WALL' };

    // Extract item titles. The OLD bug: it unioned 5 selectors including the
    // page-wide `.a-link-normal[href*="/dp/"]`, which also matches "Buy it
    // again" / "Customers also bought" recommendation carousels — polluting
    // `items` with dozens of unrelated products. Fix: scope to the order
    // item container, and use the FIRST selector tier that yields hits
    // (ordered most-specific → least) instead of unioning all of them.
    const items = await withTimeout(page.evaluate(() => {
      // Restrict to the order-detail item region; never the whole document.
      const scope =
        document.querySelector('[data-component="orderCard"]') ||
        document.querySelector('#orderDetails') ||
        document.querySelector('.order-details, [class*="order-detail"]') ||
        document.body;
      const tiers = [
        '[data-component="itemTitle"]',
        '.yohtmlc-product-title',
        '[class*="product-title"]',
        '.shipment a[href*="/dp/"]',
      ];
      for (const sel of tiers) {
        const hits = [...scope.querySelectorAll(sel)]
          .map(el => el.textContent?.trim())
          .filter(t => t && t.length > 10 && t.length < 200);
        if (hits.length) return [...new Set(hits)];
      }
      return [];
    }), 15000, `extract ${orderId}`);

    const total = await page.evaluate(() => {
      const el = document.querySelector(
        '[class*="grand-total"] .a-color-price, [class*="grandTotal"], .order-total .a-color-price');
      return el?.textContent?.trim() || '';
    }).catch(() => '');

    return { orderId, items, total };
  } catch (error) {
    return { orderId, error: error.message };
  }
}

async function main() {
  const watchdog = setTimeout(() => {
    log(`WATCHDOG: hard deadline ${HARD_DEADLINE_MS}ms exceeded — aborting.`);
    setStatus('watchdog_timeout');
    process.exit(2);
  }, HARD_DEADLINE_MS);
  watchdog.unref();

  const CDP_URL = process.env.CDP_URL || 'http://localhost:9333';
  setStatus('connecting');
  log(`Connecting to browser via CDP at ${CDP_URL}...`);

  let browser;
  try {
    browser = await withTimeout(
      chromium.connectOverCDP(CDP_URL), 20000, 'connectOverCDP');
  } catch (error) {
    log(`Failed to connect over CDP (${error.message}).`);
    setStatus('cdp_connect_failed', { error: error.message });
    process.exit(4);
  }

  const contexts = browser.contexts();
  const context = contexts[0] || await withTimeout(browser.newContext(), 15000, 'newContext');
  const page = await withTimeout(context.newPage(), 15000, 'newPage');

  const results = [];
  let loginBailed = false;

  for (let i = 0; i < ORDER_IDS.length; i++) {
    const orderId = ORDER_IDS[i];
    setStatus('looking_up', { index: i + 1, of: ORDER_IDS.length, orderId });
    const result = await lookupOrder(page, orderId);

    if (result.error === 'LOGIN_WALL') {
      log('LOGIN WALL — Amazon session dropped mid-lookup. Saving partial, stopping.');
      results.push(result);
      loginBailed = true;
      break;
    }

    // Add category suggestion based on first item
    if (result.items && result.items.length > 0) {
      const suggestion = suggestCategory(result.items[0]);
      result.suggestedCategory = suggestion?.category || null;
      result.matchedKeyword = suggestion?.matchedKeyword || null;
      result.suggestedMerchantName = createMerchantName(result.items[0]);
    }

    results.push(result);
    fs.writeFileSync('./order_details.json', JSON.stringify(results, null, 2)); // incremental

    if (result.items && result.items.length > 0) {
      const cat = result.suggestedCategory ? `→ ${result.suggestedCategory}` : '→ ?';
      log(`  ✓ [${i + 1}/${ORDER_IDS.length}] ${result.items[0].slice(0, 50)}... ${cat}`);
    } else if (result.error) {
      log(`  ✗ [${i + 1}/${ORDER_IDS.length}] Error: ${result.error}`);
    } else {
      log(`  ? [${i + 1}/${ORDER_IDS.length}] No items found`);
    }
  }

  await page.close().catch(() => {});

  // Generate ORDER_MAPPINGS code
  console.log('\n' + '='.repeat(70));
  console.log('SUGGESTED ORDER_MAPPINGS (copy to update-amazon-transactions.mjs):');
  console.log('='.repeat(70));
  console.log('');

  const mappings = [];
  const needsReview = [];

  for (const result of results) {
    if (result.suggestedCategory) {
      const merchantName = result.suggestedMerchantName.replace(/'/g, "\\'");
      mappings.push(`  '${result.orderId}': { merchantName: '${merchantName}', category: '${result.suggestedCategory}' },`);
    } else if (result.items && result.items.length > 0) {
      needsReview.push(result);
      const merchantName = result.suggestedMerchantName.replace(/'/g, "\\'");
      mappings.push(`  '${result.orderId}': { merchantName: '${merchantName}', category: null }, // NEEDS REVIEW: ${result.items[0].slice(0, 40)}`);
    }
  }

  console.log('// Auto-generated mappings');
  mappings.forEach(m => console.log(m));

  if (needsReview.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log(`⚠️  ${needsReview.length} ORDER(S) NEED MANUAL REVIEW:`);
    console.log('='.repeat(70));
    for (const r of needsReview) {
      console.log(`\nOrder: ${r.orderId}`);
      console.log(`  Item: ${r.items[0]}`);
      console.log(`  Suggested merchant: ${r.suggestedMerchantName}`);
    }
  }

  fs.writeFileSync('./order_details.json', JSON.stringify(results, null, 2));
  const autoCategories = results.filter(r => r.suggestedCategory).length;
  log(`Saved ${results.length} order details (${autoCategories} auto-categorized, ${needsReview.length} need review)`);

  // THE hang fix: disconnect the CDP browser and exit explicitly. Without
  // browser.close(), the open websocket keeps Node's event loop alive forever
  // even though all work is done — the "9-min frozen" symptom.
  await browser.close().catch(() => {});
  setStatus(loginBailed ? 'partial_login_wall' : 'done',
    { total: results.length, auto: autoCategories });
  clearTimeout(watchdog);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // Any order details already written are usable — exit 0 if so.
    let haveData = false;
    try { haveData = JSON.parse(fs.readFileSync('./order_details.json', 'utf8')).length > 0; } catch {}
    log(`${haveData ? 'NON-FATAL' : 'FATAL'}: ${err?.stack || err?.message || err}`);
    setStatus(haveData ? 'partial' : 'fatal', { error: err?.message || String(err) });
    process.exit(haveData ? 0 : 1);
  });
