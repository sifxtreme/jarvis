import { chromium } from 'playwright-core';
import fs from 'fs';

// --- Resilience scaffolding ---------------------------------------------
// Exit codes: 0 ok | 2 watchdog timeout | 3 login wall | 4 CDP connect fail | 1 other
const STATUS_FILE = './amazon_scrape_status.json';
// Full-history runs paginate hundreds of pages — give them far more headroom.
const HARD_DEADLINE_MS = parseInt(
  process.env.SCRAPE_DEADLINE_MS || (process.env.SCRAPE_ALL === '1' ? '3000000' : '300000'),
  10); // 50 min for full history, 5 min for a recent run

// Timestamped, immediately-flushed log so a 30s monitor can see progress
// even when the process is launched through a pipe.
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.writeSync(1, line);
}

function setStatus(phase, extra = {}) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      phase, updated_at: new Date().toISOString(), pid: process.pid, ...extra,
    }, null, 2));
  } catch { /* status file is best-effort */ }
}

// Reject if `promise` doesn't settle within `ms` — used to bound any Playwright
// call that has no native timeout (connectOverCDP, newPage, evaluate).
function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms); }),
  ]).finally(() => clearTimeout(t));
}

// A login wall is detected by URL first (most reliable), title second.
async function isLoginWall(page) {
  try {
    const url = (page.url() || '').toLowerCase();
    if (url.includes('/ap/signin') || url.includes('/ap/mfa') || url.includes('signin?') || url.includes('/ap/cvf')) return true;
    const title = (await page.title()).toLowerCase();
    return title.includes('sign-in') || title.includes('sign in') || title.includes('amazon sign');
  } catch {
    return false; // page navigating/closed — let caller's other guards handle it
  }
}

function bailLoginWall() {
  log('LOGIN WALL detected — Amazon session dropped. Re-auth in Chrome Canary, then re-run.');
  setStatus('login_wall', { error: 'amazon_session_dropped' });
  process.exit(3);
}

async function scrapeTransactionsFromPage(page) {
  await page.waitForTimeout(2000);

  // Get the visible text and parse it
  const pageText = await page.evaluate(() => document.body.innerText);

  // Parse transactions from the text
  const transactions = [];
  const lines = pageText.split('\n');

  let currentDate = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Match date patterns like "December 14, 2025"
    const dateMatch = line.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/);
    if (dateMatch) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const month = monthNames.indexOf(dateMatch[1]) + 1;
      const day = parseInt(dateMatch[2]);
      const year = parseInt(dateMatch[3]);
      currentDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      i++;
      continue;
    }

    // Match amount patterns like "-$44.19" or "+$17.05"
    const amountMatch = line.match(/^([+-]?)\$(\d+\.\d{2})$/);
    if (amountMatch && currentDate) {
      const sign = amountMatch[1] === '+' ? 1 : -1;
      const amount = sign * parseFloat(amountMatch[2]);
      const isRefund = sign === 1;

      // Look ahead for order ID and merchant
      let orderId = null;
      let merchant = null;
      let status = 'completed';

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();

        // Check for pending status
        if (nextLine === 'Pending') {
          status = 'pending';
        }

        // Match order ID patterns
        const orderMatch = nextLine.match(/(?:Order #|Refund: Order #)(\d{3}-\d{7}-\d{7}|[A-Z]\d{2}-\d{7}-\d{7}|[a-f0-9-]{36})/);
        if (orderMatch) {
          orderId = orderMatch[1];
        }

        // Match merchant names
        if (nextLine === 'Amazon.com' || nextLine === 'AMZN Mktp US' || nextLine === 'Amazon Fresh' || nextLine.includes('PrimeVideo')) {
          merchant = nextLine;
        }
      }

      if (orderId) {
        transactions.push({
          date: currentDate,
          amount: amount,
          payment_method: 'American Express ****1009',
          order_id: orderId,
          merchant: merchant || 'Amazon',
          status: status,
          type: isRefund ? 'refund' : 'charge'
        });
      }

      i++;
      continue;
    }

    i++;
  }

  return transactions;
}

async function main() {
  // Hard watchdog: no matter where it hangs, the process dies with a clear
  // message instead of sitting at 0% CPU forever.
  const watchdog = setTimeout(() => {
    log(`WATCHDOG: hard deadline ${HARD_DEADLINE_MS}ms exceeded — aborting.`);
    setStatus('watchdog_timeout', { error: `exceeded ${HARD_DEADLINE_MS}ms` });
    process.exit(2);
  }, HARD_DEADLINE_MS);
  watchdog.unref();

  // CDP target: defaults to Playwright's bundled Chrome-for-Testing on 9333
  // (version-matched, immune to Chrome auto-updates). Override with CDP_URL.
  const CDP_URL = process.env.CDP_URL || 'http://localhost:9333';
  setStatus('connecting');
  log(`Connecting to browser via CDP at ${CDP_URL}...`);

  let browser;
  try {
    browser = await withTimeout(
      chromium.connectOverCDP(CDP_URL), 20000, 'connectOverCDP');
  } catch (error) {
    log(`Failed to connect over CDP (${error.message}). Start the managed browser with:`);
    log('  bash ensure-amazon-browser.sh   (launches bundled Chrome-for-Testing on 9333, persistent Amazon login profile)');
    setStatus('cdp_connect_failed', { error: error.message });
    process.exit(4);
  }

  const contexts = browser.contexts();
  const context = contexts[0] || await withTimeout(browser.newContext(), 15000, 'newContext');
  const page = await withTimeout(context.newPage(), 15000, 'newPage');

  const url = 'https://www.amazon.com/cpe/yourpayments/transactions';
  setStatus('navigating');
  log(`Navigating to: ${url}`);

  // Retry navigation up to 3 times with increasing timeouts
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const timeout = 30000 * attempt; // 30s, 60s, 90s
      log(`  Attempt ${attempt}/3 (timeout: ${timeout/1000}s)...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(3000); // Give page time to load dynamic content
      break;
    } catch (e) {
      lastError = e;
      log(`  Attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) log('  Retrying...');
    }
  }
  if (lastError && !(await page.title())) {
    setStatus('navigation_failed', { error: lastError.message });
    throw lastError;
  }

  // Login wall check — URL-based + title. Session can be valid here but drop
  // mid-pagination, so this is also re-checked after every page advance.
  if (await isLoginWall(page)) {
    await page.close().catch(() => {});
    bailLoginWall();
  }

  // Pagination loop — keep advancing Next until: target date reached, the
  // Next-Page control is gone/disabled (true end of history), or MAX_PAGES.
  //
  // Amazon's Next Page is a FORM POST, not a JS button: it's an
  //   <input type="submit" name="ppw-widgetEvent:DefaultNextPageNavigationEvent:{...cursor...}">
  // wrapped in <span class="a-button">. The old code clicked the wrapper span
  // and waitForTimeout'd — the form never submitted, so page N+1 == page N and
  // the run stopped at ~40 txns thinking Amazon "capped" it. We now click the
  // real submit input and wait for the POST navigation.
  const NEXT_SUBMIT = 'input[type=submit][name^="ppw-widgetEvent:DefaultNextPageNavigationEvent"]';
  const untilDate = process.env.SCRAPE_UNTIL_DATE || null;  // YYYY-MM-DD
  const scrapeAll = process.env.SCRAPE_ALL === '1';
  // Recent runbook use rarely needs >2 pages (~40 txns); cap low by default so
  // a normal run is fast and never accidentally crawls full history.
  const maxPages = parseInt(process.env.MAX_PAGES || (scrapeAll ? '600' : '3'), 10);
  if (untilDate) log(`Target: scrape back to ${untilDate}`);
  log(`Mode: ${scrapeAll ? 'FULL HISTORY' : 'recent'} | max pages: ${maxPages}`);

  const pagesScraped = [];
  const allTransactions = [];
  const seenOrderIds = new Set();
  let stalledOnce = false; // one retry before declaring a genuine Amazon cap

  // Write the cache from whatever we have so far. Called after EVERY page so a
  // crash on page N still leaves pages 1..N-1 usable — the runbook only needs
  // ~2 recent pages anyway, so partial is almost always "complete enough".
  const saveOutput = (status) => {
    const seen = new Set();
    const uniq = allTransactions
      .filter(t => { const k = `${t.order_id}-${t.amount}`; return seen.has(k) ? false : seen.add(k); })
      .sort((a, b) => b.date.localeCompare(a.date));
    const charges = uniq.filter(t => t.type === 'charge');
    const refunds = uniq.filter(t => t.type === 'refund');
    fs.writeFileSync('./amazon_transactions.json', JSON.stringify({
      extracted_at: new Date().toISOString().split('T')[0],
      source: 'Amazon Payments Transactions',
      pages: pagesScraped,
      partial: status === 'partial',
      transactions: uniq,
      summary: {
        total_transactions: uniq.length,
        total_charges: charges.length,
        total_refunds: refunds.length,
        date_range: { from: uniq[uniq.length - 1]?.date || null, to: uniq[0]?.date || null },
      },
    }, null, 2));
    return { uniq, charges, refunds };
  };

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    setStatus('scraping', { page: pageNum, collected: allTransactions.length });
    log(`Scraping page ${pageNum}... (heartbeat)`);

    // Re-check login on every page — Amazon drops long sessions mid-run.
    if (await isLoginWall(page)) {
      await page.close().catch(() => {});
      bailLoginWall();
    }

    const pageTransactions = await withTimeout(
      scrapeTransactionsFromPage(page), 45000, `scrape page ${pageNum}`);
    log(`  Found ${pageTransactions.length} transactions on page ${pageNum}`);

    if (pageTransactions.length === 0) {
      // Zero rows can mean a silent login redirect — distinguish before giving up.
      if (await isLoginWall(page)) {
        await page.close().catch(() => {});
        bailLoginWall();
      }
      log('  Empty page — stopping');
      break;
    }

    const dates = pageTransactions.map(t => t.date).sort();
    const earliestOnPage = dates[0];
    const latestOnPage = dates[dates.length - 1];
    console.log(`  Page ${pageNum} date range: ${earliestOnPage} to ${latestOnPage}`);

    const newOrderIds = pageTransactions.filter(t => !seenOrderIds.has(t.order_id));
    log(`  Page ${pageNum}: ${earliestOnPage}..${latestOnPage} | ${newOrderIds.length} new / ${pageTransactions.length}`);
    pageTransactions.forEach(t => seenOrderIds.add(t.order_id));
    // Only keep genuinely-new orders so an overlapping page doesn't double-count.
    pagesScraped.push(pageNum);
    allTransactions.push(...newOrderIds);
    saveOutput('partial'); // incremental — crash after here still keeps this page

    if (untilDate && earliestOnPage <= untilDate) {
      log(`  Reached target date ${untilDate} — stopping`);
      break;
    }
    if (pageNum === maxPages) {
      log(`  Hit max-pages limit (${maxPages}) — stopping`);
      break;
    }

    // Locate the real Next-Page submit input. Absent => end of history
    // (oldest page reached) — this is the clean, correct stop condition.
    const nextSubmit = page.locator(NEXT_SUBMIT).first();
    const nextCount = await nextSubmit.count();
    if (nextCount === 0) {
      // Fallback: some views use an AJAX "Load more" button instead.
      const loadMore = page.getByRole('button', { name: /load more/i, includeHidden: true }).first();
      if (await loadMore.count() === 0) {
        log('  No Next-Page submit and no Load-more — reached end of history. Stopping.');
        break;
      }
      log('  Using "Load more" fallback...');
      await loadMore.evaluate(el => el.click()).catch(() => {});
      await page.waitForTimeout(3500);
      continue;
    }

    // Advance one page. ANY failure here (detached page, nav timeout, Amazon
    // interstitial) is non-fatal: we already have pages 1..N saved, so we stop
    // cleanly and keep them. Single submit path — no double-submit.
    const beforeFirst = pageTransactions[0]?.date || latestOnPage;
    log('  Submitting Next Page (form POST)...');
    try {
      // Proven mechanism (advanced pages 1→6 in testing): click the real
      // submit input, let domcontentloaded settle. No JS form.submit()
      // fallback — that double-submitted and detached the page.
      await Promise.all([
        page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {}),
        nextSubmit.click({ timeout: 10000 }),
      ]);
      await page.waitForTimeout(2000); // settle dynamic content
    } catch (e) {
      log(`  Advance failed on page ${pageNum} (${e.message?.split('\n')[0]}). Keeping ${allTransactions.length} txns, stopping cleanly.`);
      break;
    }
    if (page.isClosed()) {
      log(`  Page closed after page ${pageNum}. Keeping ${allTransactions.length} txns, stopping cleanly.`);
      break;
    }

    // Verify advancement. A real cap = clicked a present, enabled Next but
    // content didn't change. Retry once, then stop.
    let afterFirst = null;
    try {
      afterFirst = await page.evaluate(() => {
        const m = document.body.innerText.match(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/);
        return m ? m[0] : null;
      });
    } catch { break; } // page went away mid-eval — stop with what we have
    if (afterFirst && beforeFirst) {
      const norm = (d) => new Date(d).toISOString().slice(0, 10);
      let same = false;
      try { same = norm(afterFirst) === norm(beforeFirst); } catch {}
      if (same) {
        if (!stalledOnce) {
          log('  Page did not advance — retrying once...');
          stalledOnce = true;
          await page.waitForTimeout(3000);
          continue;
        }
        log('  Still not advancing after retry — Amazon capped this view. Stopping.');
        break;
      }
      stalledOnce = false;
    }
  }

  await page.close().catch(() => {});

  const { uniq, charges, refunds } = saveOutput('done');
  log(`Saved ${uniq.length} transactions to amazon_transactions.json`);
  log(`  Charges: ${charges.length} | Refunds: ${refunds.length}`);
  log(`  Date range: ${uniq[uniq.length - 1]?.date || null} to ${uniq[0]?.date || null}`);
  setStatus('done', {
    total: uniq.length,
    pages: pagesScraped.length,
    date_range: { from: uniq[uniq.length - 1]?.date || null, to: uniq[0]?.date || null },
  });
  clearTimeout(watchdog);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // True fatal (couldn't even start). If any pages were saved incrementally
    // the cache is still on disk and usable — exit 0 so the wrapper doesn't
    // report a hard failure for what is really a usable partial.
    let haveData = false;
    try { haveData = JSON.parse(fs.readFileSync('./amazon_transactions.json', 'utf8')).transactions?.length > 0; } catch {}
    log(`${haveData ? 'NON-FATAL' : 'FATAL'}: ${err?.stack || err?.message || err}`);
    setStatus(haveData ? 'partial' : 'fatal', { error: err?.message || String(err) });
    process.exit(haveData ? 0 : 1);
  });
