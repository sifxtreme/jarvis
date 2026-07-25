# Jarvis Improvements From Real Use

Improvements identified during actual monthly finance runbook sessions. Each item has the failure mode that surfaced it.

## Tier 1 — Would have prevented real pain

### Sync freshness banner per source
**Problem:** April 2026 amex was stuck at 04/16 due to expired Teller enrollment. Ran the runbook and gave wrong totals twice before noticing the sync was 16 days behind.
**Want:** Dashboard shows last successful sync date per source. Red banner if any source >5 days stale.
**Where:** Top of finance dashboard. Per-source row in some "data health" panel.

### Sync freshness alerts
**Problem:** No notification when sync goes stale. Only caught it because the runbook output was missing recurring transactions.
**Want:** Email/push when amex/bofa hasn't synced in >48hr.
**Where:** Background job that watches `BankSyncLog`.

### Recurring "Missing" view needs three states
**Problem:** The `/missing-recurring` view shows Frontier + AAA as missing in May even though Frontier is just `hidden=true` and AAA was paid 2x in April. False positives.
**Want:** Distinguish (a) didn't fire yet but expected, (b) sync stale so we just don't see it, (c) hidden so we filter it out.
**Where:** Recurring detection logic. Add `reason` field per missing item.

## Tier 2 — Better data quality

### Auto-categorize: word-boundary state matching
**Problem:** `HOMEDEPOT.COM 800-... GA` matched "Gas" because of trailing "GA" state code. Categorized $204 Home Depot faucet purchase as Gas.
**Want:** State suffixes (`\b(GA|CA|NM|...)$`) shouldn't match merchant keywords. Word-boundary regex on the merchant portion only.
**Where:** `predicted_category` in `app/lib/finances/predictions.rb`.

### Big-ticket sanity check at ingest
**Problem:** Costco $861 (parents' washer/dryer) got auto-categorized as Groceries. Tectonic Coffee $206 (LA coffee roaster, not a grocery store) auto-categorized as Groceries.
**Want:** Any single charge ≥$500 in a normally-small category gets a "needs review" flag. Or any charge that's >3x the median for that merchant.
**Where:** Post-prediction step. Set `reviewed=false` on outliers automatically.

### Receipt itemization pipeline
**Problem:** Costco/Target receipts can have 8-26 line items spanning multiple categories. Today the manual pipeline is: download PDF → eyeball → split manually → call API. Painful.
**Want:** Auto-parse Costco/Target receipt PDFs. Suggest line-item splits with category guesses.
**Where:** New `receipts/` module. Mirrors what `experiments/finance-tools/scrape-amazon-transactions.mjs` does for Amazon.

### "Hidden cash flow" view
**Problem:** April 2026 had $8,703 of hidden Asif Family spend (ABQ move). Invisible in totals but real money out. Without seeing it, the household budget picture is incomplete.
**Want:** A separate "Off-budget cash flow" panel showing what was hidden and why. Can be collapsed by default but clearly visible.
**Where:** New dashboard panel. Filter txns by `hidden=true`.

## Tier 3 — UX / API

### API partial-update support
**Problem:** `PUT /financial_transactions/:id` clobbers fields not provided. SDK works around it by fetching+merging, but the API itself is a footgun for any third-party scripts.
**Want:** PATCH semantics — only update fields explicitly in the body.
**Where:** `FinancialTransactionsController#update`.

### Rename `show_hidden=true` parameter
**Problem:** `show_hidden=true` actually means "ONLY hidden", not "include hidden". Default (no param) returns both. Surprising semantics.
**Want:** Either fix the behavior so `show_hidden=true` includes hidden, or rename to `hidden_only=true`.
**Where:** `FinancialTransactionsController#index`.

### Refund pairing in UI
**Problem:** When a refund hits, it's a separate row from the original charge. Hard to see the pair when scanning a list.
**Want:** UI links refunds to their matching charge. Show as `+$50 [→ refunded -$50 on date]`.
**Where:** Transaction list view + matching logic.

### Amortization leak indicator
**Problem:** SCE $215.95 amortized from March shows up in April's "Tesla" category, inflating April. There's no UI hint that this is from a different month.
**Want:** When a txn appears in a month-view because of amortization, show "← from 2026-03 amortization".
**Where:** Month-summary aggregation + UI.

## Tier 4 — Smart defaults

### Trip-mode auto-tagging
**Problem:** During Hawaii trip (4/9-4/15), all charges in Honolulu auto-categorized as "Hawaii Trip" — but Target purchases on 4/8 (day before flight, in Cerritos) were prep for the trip and got miscategorized as Yusuf+Musa initially.
**Want:** User can mark a date range + trip name. Auto-suggest "Hawaii Trip" for charges (a) in the location during dates, (b) within 2 days before and shopping pattern looks like trip prep.
**Where:** New "Trips" entity. Categorization rule extension.

### Per-merchant override memory
**Problem:** Tectonic Coffee was miscategorized as Groceries. After I moved it to Coffee, the next Tectonic charge will probably go back to Groceries because the predictor doesn't learn from my correction.
**Want:** When user manually changes a merchant's category, that becomes the default for future occurrences of that merchant.
**Where:** `predicted_category` in `predictions.rb` should check user override history first.

### Monthly budget pre-mortem
**Problem:** April pain showed up at month-end. By then it's too late to course-correct.
**Want:** Lock in expected income/expenses at start of month. Surface deltas live as transactions land. Notify when category is on track to exceed budget by >X%.
**Where:** New "Budget" entity per category. Webhook on every new transaction.

---

## Source

These come from the April 2026 monthly runbook session (2026-05-02). Process notes for the AI side are in `~/.claude/projects/-Users-asifahmed-code/memory/feedback_finance_runbook.md`.
