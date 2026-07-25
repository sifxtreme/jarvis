# Monthly Finance Review Runbook — Moved

The canonical runbook is now [`cerebro-prds/runbooks/FINANCE_RUNBOOK.md`](../../cerebro-prds/runbooks/FINANCE_RUNBOOK.md), at:

`/Users/asifahmed/code/cerebro-prds/runbooks/FINANCE_RUNBOOK.md`

This file remains only as a compatibility pointer for existing links and grep workflows. Make all content updates in the canonical document.

## Legacy heading inventory

Every heading from this file's pre-deduplication HEAD is retained below verbatim so old searches still resolve:

- `# Monthly Finance Review Runbook`
- `## ⚠️ Process Rules (Read First)`
- `## Quick Start (For Claude Code)`
- `## "It looks broken" — the three false alarms (read before debugging a sync)`
- `### 1. Chase looks stuck → the charges are PENDING, not missing`
- `### 2. Income looks like it collapsed → the paychecks haven't landed yet`
- `### 3. "Amazon has no items to look up" → the filter is wrong, not the data`
- `## Sync Freshness — Step 0 of Every Runbook`
- `### Which sources are AUTO-synced vs MANUAL (updated 2026-07-12)`
- `## Manual Steps (if needed)`
- `## Part 1: Check What's Missing`
- `### Find Missing Recurring Transactions`
- `### Find Uncategorized Transactions`
- `## Part 2: Add Manual Transactions`
- `### Using the SDK`
- `### Using curl (Quick Add)`
- `### Common Monthly Transactions Templates`
- `## Part 3: Categorize Amazon Transactions`
- `### Prerequisites`
- `### Start Chrome Canary`
- `### Run the Pipeline`
- `### Handle Refunds`
- `## Part 4: Fix Missing Merchant Names`
- `### Find Transactions Needing Names`
- `### Fix Using Historical Patterns`
- `### Common Patterns`
- `## Part 5: Audit Pass + Monthly Summary`
- `### Audit Pass (REQUIRED before declaring done)`
- `### Monthly Summary`
- `### Saved analysis tools (build these into the workflow)`
- `## SDK Reference`
- `### CLI Commands`
- `### Quick Start`
- `### Core Methods`
- `#### List & Get`
- `#### Create`
- `#### Update (Safe - preserves existing fields)`
- `#### Delete`
- `### Query Helpers`
- `### Auto-Categorization`
- `### Trip Categorization`
- `### Analysis`
- `### Legacy Aliases`
- `## Scripts Reference`
- `## Known Gotchas & Lessons Learned`
- `### ⚠️ ALWAYS ASK FOR AMBIGUOUS CHARGES`
- `### ⚠️ Search Command Behavior (FIXED)`
- `### Auto-Categorization vs Amazon Pipeline`
- `### Same-Amount Orders (e.g., Three $11.04 Transactions)`
- `### Refunds Show as Negative Amounts`
- `### Unmatched Transactions`
- `### Amazon Fresh Doesn't Appear in Payments Page`
- `### ⚠️ Refund Sign Flipping (CRITICAL)`
- `### Always Use the SDK, Not Ad-hoc Scripts`
- `### Matching Script Auto-Detects Months`
- `## Troubleshooting`
- ### `show_hidden=true` API quirk (CRITICAL)
- `### SDK update with null fields`
- `### Chrome Canary Issues`
- `### Long-running scrape "looks hung"`
- `### Page 2 Not Scraping`
- `### API Partial Update Bug`
- `### API Key`
- `## Kindle books — a separate pipeline from Amazon (added 2026-07-12)`
- `## Receipts-from-email enrichment — DON'T (settled 2026-07-12)`
- `## Parents ledger — some Jarvis charges are billed to Dad/Mom`
- `## The Jarvis DB has version history (PaperTrail)`
- `## Related Projects`
- `## Part 6: CSV Imports (BofA, and now Chase)`
- `### 🛑 Read this before importing ANY card that already has an aggregator feed`
- `### Import Workflow`
- `### BofA CSV Classification Rules`
- `### ⚠️ Reimbursements: ALWAYS a separate NEGATIVE row. Never net into the charge.`
- `### BofA Merchant Mapping`
- `### Amortization Rules`
- `### Duplicate Prevention Protocol`
- `### Seasonal Patterns (Ramadan/Eid — typically March/April)`
- `### Things to Always Ask About`
- `## Category Reference`
- ## `merchant_name` is doing two different jobs (discovered 2026-07-13)
- `## Special: Trip Categorization`
