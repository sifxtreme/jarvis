# Bank Sync & Categorization — Architecture / Decision Record

**Owner:** Asif · **Last updated:** 2026-07-12
**Supersedes:** `PLAID_INTEGRATION_PLAN.md` (which was the Amex-only migration plan; kept for history)

---

## TL;DR — current state

| Bank | Provider | Status |
|---|---|---|
| **amex** | **Plaid OAuth** | ✅ **Live.** Migrated 2026-07-12. 3-week outage backfilled (111 txns). `bank_connections` id 9, `sync_from_date=2026-06-22`. |
| **hafsa_chase** | Teller *(to be migrated)* | ⚠️ **Feed frozen since 2026-07-08.** Migration to Plaid is **coded, deployed, and one click away** — blocked only by Chase's own OAuth server returning 500. |
| **bofa / zelle / cash / venmo** | **Manual CSV** | Not a sync. Statement import (see `finance-tools/import-bofa.mjs`). |

**Teller is being retired.** The only thing keeping it alive is Chase's broken OAuth endpoint.

---

## 1. The decision: Plaid, not Teller

### Why Teller is failing — it's structural, not a bad week

Teller is a **credential / screen-scraping** aggregator: it logs into the bank *as you* and reads the page. That entire model is being dismantled:

- **CFPB Section 1033** (open banking) explicitly calls screen scraping risky and pushes the industry to API access — giving banks regulatory cover to cut off credential-based aggregators.
- Banks are migrating to **OAuth / FDX**, where you authenticate on *the bank's own site* and the aggregator never sees your password.
- **Plaid, MX, and Finicity hold first-party OAuth agreements** with Amex, Chase, BofA, Capital One. Teller — the cheap, free-tier-generous option — **does not have those deals at the same tier.** As each bank flips the switch, Teller loses access; the incumbents don't.

**Proven in one comparison, same card, same day:**

| | Teller | Plaid |
|---|---|---|
| **Amex** | password form → **blocked, dead 3 weeks** | OAuth redirect to amex.com → **flawless, 111 txns backfilled** |

### The part that actually hurt: Teller fails *invisibly*

This is the real indictment, and the reason for the migration.

- **Amex** at least **errored** — 124 consecutive `enrollment.disconnected`.
- **Chase didn't error at all.** For 4 days Teller reported:
  ```
  GET /accounts     → 200  status:"open"        ← "fine"
  GET /balances     → 200  $486.03 / $26,792    ← "fine"
  GET /transactions → 200  1013 rows            ← 4 days stale
  every 3h sync     → status: success           ← "fine"
  ```
  Meanwhile the Chase app showed charges (`COSMETICS CO $111.60`) Teller simply didn't have.

**Teller's API has no health endpoint, no status field, no freshness indicator, no incident feed.** There is no way to ask it whether its data is still flowing.

**The only signal that caught it:** `fetched_count` in `bank_sync_logs` grew every day for weeks, then **flatlined at 1013 on Jul 8** and never moved.

> **A provider that fails loudly is fine. One that reports `success` while serving stale data cost 3 weeks of Amex and a $75 overbill to Asif's dad.**

### What Plaid gives us that Teller doesn't

| | Teller | Plaid |
|---|---|---|
| Institution health API | ✗ | ✅ per-product (`item_logins`, `transactions_updates`, `auth`…) |
| Incident history | ✗ | ✅ 13 Chase incidents since April, with timestamps |
| API request logs | ✗ | ✅ dashboard, every call |
| Link session events | ✗ | ✅ full event stream (`onEvent`) |
| Merchant enrichment | ✗ | ✅ `merchant_entity_id`, location, `personal_finance_category`, logo |

Plaid's health API is what **diagnosed the Chase outage in one call**. Teller lied for four days.

---

## 2. Architecture

`Plaid::API` (`backend/app/lib/plaid/api.rb`) mirrors the old `Teller::API`. Raw `Net::HTTP` — **no gem** (Plaid needs no mTLS; keeps deploys simple).

- **Sync:** `/transactions/sync`, cursor-paginated. Cursor persisted to `bank_connections.transactions_cursor`, and **only on success** — an error leaves the cursor unmoved so the next run safely re-fetches.
- **Posted only:** `pending` rows are skipped. A pending charge gets a **different `transaction_id`** when it settles; ingesting it would duplicate.
- **Dedup:** `find_or_initialize_by(plaid_id: transaction_id)`, `next if reviewed?`.
- **Amount:** direct passthrough. Plaid's sign convention (spend +, refund −) **already matches** the existing data. Never `abs`, never negate.
- **Logging:** every sync writes a `BankSyncLog` row (`provider='plaid'`). Freeform logs go to stdout (`RAILS_LOG_TO_STDOUT=true`) → `docker logs jarvis-api-1 | grep '[Plaid]'`.

### The cutover cutoff — **load-bearing**

**Plaid and Teller assign different transaction IDs**, so `find_or_initialize_by(plaid_id:)` **cannot dedupe across providers.** Plaid's backfill reaches ~24 months. Without a cutoff it would re-insert the entire history as duplicates.

`/plaid/exchange` therefore sets `sync_from_date` on first connect, derived from **that source's own last transaction**:

```
amex        → 2026-06-22   (where Teller died)
hafsa_chase → 2026-07-05   (where Teller froze)
```
The sync then ingests strictly `> sync_from_date`. On the Amex migration this filtered Plaid's **440** returned transactions down to the **111** that were actually missing. Without it: ~330 duplicates.

### Linking

`/plaid-connect` — bank picker → Plaid Link → OAuth → `/plaid/exchange`.

- `name` is an **explicit, allowlisted** param (`PlaidController::LINKABLE_NAMES`). It was once hardcoded to `'amex'`; linking a second bank would have **silently clobbered the working Amex connection**.
- Link is fully instrumented (`onEvent` + full `onExit` payload), surfacing `error_code`, `error_type`, `request_id`, `link_session_id` to a copyable on-page log. Without this a failure inside the bank's own OAuth page is invisible.
- `PLAID_REDIRECT_URI` is set and registered, but **note:** Chase never sees it — Plaid uses its own (`cdn.plaid.com/link/v2/stable/oauth.html`) for the bank hop and relays back. Desktop web uses a popup regardless.

---

## 3. Categorization (`Finances::Predictions`)

Deterministic, tiered, **no LLM**. Runs on every sync. Learned history **always** beats Plaid's guess.

1. learned by **`merchant_entity_id`** (Plaid's stable canonical merchant id — strongest, grows as Asif reviews)
2. learned by **`Utils#merchant_key`** (canonical normalized key)
3. learned by **anchored token-prefix** — bridges Teller's raw `AMAZON MARKETPLACE NAMZN.COM/BILL WA` to Plaid's clean `Amazon`. **Directional**: only the lookup key may prefix a learned key. The reverse let `"tesla"` (the car loan) swallow `"tesla insurance company"` (Car Insurance).
4. **Plaid's `personal_finance_category`** → taxonomy (conservative map)
5. **vetted keyword rules** — whole-token only, never substring (the `Bug Zapper Racket` → `racket` → kids-category bug). Earns its place because **Teller rows carry no PFC at all.**

### Guards (each one paid for in blood)

| Guard | Why |
|---|---|
| `reviewed: true` training only | Otherwise it **trains on its own output** — one bad prediction becomes its own supporting evidence. Coverage went 34%→92%, so the training set was about to be mostly self-written. |
| `TRAINING_WINDOW = 24.months` | Stale one-off event labels age out. **Measured best on both precision AND recall** (12/36/48/84/240mo were all worse). |
| `MIN_VOTES = 2` (category) | A single quirky tag must never propagate. |
| `NAME_MAJORITY = 0.8`, `NAME_MIN_VOTES = 3` | **Names are not categories.** A merchant's *category* is stable (Fandango is always Fun); its *name* is often **what you bought that day**. |
| `ITEM_SPECIFIC_MERCHANTS` | Amazon/Kindle: learn the **category**, never the **name**. |
| `location_only?` | **A city is not a merchant.** See below. |

### What it deliberately will NOT predict

Asif's taxonomy has two axes:
- **"What kind of purchase"** (Eating Out, Groceries, Gas, Bills) — Plaid's classifier knows this.
- **"Whose / what purpose"** (Hafsa, Yusuf, Musa, Kids, Gifts, Nanny, Asif Career) — **Plaid can never know this.**

So `GENERAL_MERCHANDISE_*`, clothing, superstores and Amazon are left **blank on purpose**. A blank Asif reviews beats a wrong label that silently distorts a monthly total.

**Measured:** holdout backtest against 300 of Asif's own labels, excluded from training → **~82–84% precision.** It does the boring merchants so he only touches the judgment calls.

### The two root-cause bugs (found 2026-07-12, both were invisible)

Four separate "weird label" bugs turned out to be **two root causes**:

**A. A city is not a merchant.** A $209.92 TNT Fireworks purchase arrived as literally `"LAKEWOOD, CA"` — Plaid's `merchant_name` was `null` and its classifier guessed `RENT_AND_UTILITIES` (because *City of Lakewood* looks like a utility bill). Square passes through only the **location** when a seller hasn't set a business name. So every merchant in that town collided:

```
H MART - LAKEWOOD       → Groceries
CHARO CHICKEN LAKEWOOD  → Eating Out
CITY OF LAKEWOOD        → Bills
LAKEWOOD, CA            → a Ramadan party / movie snacks / fireworks
```

**"Ramadan Party 2024" and "Dog Man Snacks" were never two bugs. They were one bug wearing two hats** — and min-votes / training-window / name-majority were all patching *hats*.

**B. The domain regex was eating merchant names.** It stripped the whole domain token, so `FANDANGO.COM 866-857-5191 CA` → key `"ca"`. Every `.COM` merchant with a trailing state code (`MADEWELL.COM`, `AMAZON.COM`, `NAMECHEAP.COM`) collapsed into the same junk bucket. **This was invisible in the backtest** — precision read 84% while merchants quietly merged behind it.

> **Lesson: a good aggregate metric can hide a structural bug.** Both were found by Asif asking *"wtf is this?"* about one weird row.

---

## 3b. CSV import — the path for Chase (decided 2026-07-13)

**Chase's OAuth API is down** (see §4), Teller's Chase feed is frozen, and Teller's repair crashes. **Asif is fine dropping CSVs.** So CSV is Chase's ingestion path for now, and a permanent escape hatch for any future aggregator failure.

### ⚠️ The BofA importer will NOT work for Chase. Do not reuse it blindly.

`import-bofa.mjs` dedupes on **`(date, amount, merchant_name)`**. That works for BofA because those rows didn't exist yet. **It would be a disaster for Chase:**

- Teller already synced Chase **through 2026-07-05** (4,178 rows).
- A **June** Chase CSV is therefore **~100% already in the DB**. A **July** CSV overlaps Jul 1–5.
- Existing Teller rows carry **curated** names (`Sprouts`, `Costco`, `Madwell`); the CSV carries **raw** descriptors (`SPROUTS FARMERS MAR #123 LAKEWOOD CA`). **They never match** — so a name-based dedup inserts ~200 duplicate Chase transactions.

### The correct dedup: multiset match on `(date, amount)`

Name matching is impossible across providers. Match on date+amount, and **count**:

```
for each (transacted_at, amount) group:
    csv_count = rows in the CSV
    db_count  = existing rows for that source
    insert    = max(0, csv_count - db_count)     # only the surplus
```

This is right on both edges: it absorbs the Teller overlap **and** preserves genuinely repeated charges (two $7.39 Masjid Cafes on the same day survive as two — cf. the documented 529-Children ×2 multi-kid exception).

### Flow
1. Asif drops the CSV (June and/or July).
2. **Dry run** — show new vs. already-present, with counts. June should dedupe out almost entirely; that is the sanity check that dedup works.
3. Import the surplus. July's `Jul 6 → today` is the real payload (the frozen window).
4. Predictor categorizes the new rows. **Land the city-key fix first** (§4) — CSV rows have no Plaid enrichment, so learned history is the *only* tier that can categorize them.

---

## 4. Open items

> ### ▶ RESUME HERE (next session)
> **1. Chase CSV import** — Asif is dropping a June and/or July Chase CSV. Build the importer with **multiset `(date, amount)` dedup** (§3b). **Do NOT reuse `import-bofa.mjs`'s name-based dedup — it will insert ~200 duplicates.** Dry-run, show him, then import.
> **2. Land the city-key fix FIRST** (item 2 below) — CSV rows have no Plaid enrichment, so learned history is the only tier that can categorize them, and it's currently running at a fraction of strength.
> **3. Awaiting Asif's call:** two suspicious duplicate income rows on **2026-01-19** (`Asif Income $6,030.04` ×2, `Hafsa Income $3,388.46` ×2) — inflating January by **$9,418**. He is paid on *different* days, so same-day identical paychecks look like a double-import. Do not touch income without his OK.

| # | Item | Notes |
|---|---|---|
| 1 | **Chase CSV import** | See §3b. The active task. |
| 2 | **Categorizer: strip the CITY from `merchant_key`** ← *biggest coverage win* | See below. |
| 3 | **Dedup + provenance** | See below. |
| 4 | **Staleness monitor** | See below. |
| 5 | **Migrate Chase to Plaid** | Code **done and deployed**. Blocked by Chase's dead API. |
| 6 | Amazon **refund** item-naming | `lookup-orders.mjs` names from `items[0]` of the order, but a return is usually only *some* items — an $8.83 nose-ring refund got labeled a cheese grater. Fix: read `/spr/returns/history` for negative amounts. |
| 7 | Retire Teller entirely | Follows item 5. Then delete mTLS certs, enrollments, `/teller-repair`. |

### Item 2 — the city is inside the merchant key, and it's gutting the learned tier

**Measured 2026-07-13** over the curated training set:

```
Sprouts   →  7 keys / 113 txns     ← 113 transactions teaching almost nothing
   "sprouts", "sprouts san francisco", "sprouts farmelakewood", "sprouts farmecerritos"
Walmart   →  8 keys /  13 txns
Bread     →  6 keys /  18 txns
69 merchants are split across >1 key.
```

Amex **truncates and concatenates** merchant + city: `SPROUTS FARME` + `LAKEWOOD` → `"sprouts farmelakewood"`. So the same store in two cities becomes two unrelated merchants.

**Fix:** strip the location from the key — data-driven from `raw_data.location.city` where present, **plus glued-suffix handling** (a token *ending in* a known city name gets that suffix removed). Build the city vocabulary from the data itself.

**⚠️ Do NOT merge these, they are correct:**
```
Parking → 15 keys   (airport parking, Santa Monica, Culver City…)
Diapers → 25 txns   (Amazon, Target Cerritos, Target Garden Grove…)
Book / Coffee / Bread / Farmers Market
```
**Asif's `merchant_name` is often WHAT HE BOUGHT, not who he bought from.** Those keys *should* be many-to-one. This is also why name-propagation kept exploding — `merchant_name` is doing double duty as merchant identity *and* item description.

### Item 3 — dedup + provenance

**~2,500 rows have no stable dedup id** (`plaid_id IS NULL`): bofa 730/734, zelle 281/281, cash 423/486, venmo 146/157, hafsa_chase 801/4178. `find_or_initialize_by(plaid_id:)` protects Plaid/Teller rows; **manual/CSV rows are unprotected.** Drop the same CSV twice → everything duplicates.

**Fix:**
- **Deterministic synthetic id** for CSV/manual rows: `csv:<source>:<date>:<amount>:<hash(descriptor)>:<n>`, where `n` is the occurrence index *within the file*. Makes re-import a no-op while preserving legitimately identical rows (the 529 ×2 case).
- **Explicit `ingest_source` column** (`plaid` | `teller` | `csv` | `manual`). Provenance is currently only *inferable* (`raw_data.transaction_id` → Plaid; `plaid_id` but no `transaction_id` → Teller; null → manual). Fragile — and it matters, because **every provider assigns a different id to the same transaction**, which is the entire reason the Amex cutover needed a date cutoff.

### Why Chase is blocked (2026-07-12) — **not our bug**

Chase's OAuth server returns **500 to everything**:

```
PLAID_INDIVIDU17 (ours)    → HTTP 500
BOGUS_CLIENT_XYZ (garbage) → HTTP 500
(no client_id at all)      → HTTP 500
```

A working OAuth server returns **400** for a bad client_id. Returning 500 to *every* request — valid, invalid, or absent — means the endpoint **is not functioning**. This exonerates our code, the Plaid Trial plan, `PLAID_INDIVIDU17`, and the redirect_uri. **Retry when Chase fixes their server.**

*(Chase has had **13 incidents since April** — Apr 5, Apr 19, May 17, May 26, May 31, Jun 6–7 (25h), Jun 14, Jun 28 (11h), Jul 5, Jul 10, Jul 11–12 (25h). Their reliability is its own risk factor.)*

### The staleness monitor (do this next)

Both failures — Amex's death **and** Chase's freeze — would have been caught on **day one** by one check. Neither raised an error; both reported `success`.

**The signal is data freshness, not sync status:**
- `fetched_count` stops growing, **or**
- newest transaction stops advancing while the account is clearly in use.

The in-app health check **provably cannot see this**: it only flags a connection on sync **error** or data **>30 days** old. Chase was neither — sync said `success` and its data was 12 days old. It stayed invisible.

~20 lines against `bank_sync_logs`. **This is the single highest-value thing left.**

---

## 5. Decision log

| Date | Decision |
|---|---|
| 2026-07-12 | **Amex → Plaid.** Teller's Amex enrollment dead 3 weeks (screen-scrape blocked + Plat→Green downgrade closed the enrollment). Migrated, backfilled 111 txns. |
| 2026-07-12 | **Retire Teller.** Second silent failure in one month (Chase frozen while reporting success). Not an engineering problem — Teller is on the wrong side of the screen-scraping shutdown, *and* it hides the damage. |
| 2026-07-12 | **Categorizer stays deterministic (no LLM).** Codex concurred. LLM is reserved for the genuinely ambiguous "whose/what purpose" axis; everything else is code. |
| 2026-07-12 | **Blanks beat wrong guesses.** Ambiguous merchants (Amazon, clothing, superstores) are left uncategorized on purpose. |
| 2026-07-12 | **Email-receipt enrichment: rejected.** Amazon receipts go to Hafsa's inbox — no access, and not worth getting. The Playwright scrape stays. |
