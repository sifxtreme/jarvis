# Plaid Integration Plan (Amex via OAuth)

**Status:** Ready to execute. Trigger = tomorrow's Teller retry fails.
**Goal:** Replace the Teller screen-scrape connection for **Amex only** with Plaid's
first-party **OAuth** connection (Amex Account Financials API). Automatic 3-hour sync,
no re-auth churn. **Chase stays on Teller** (it works).

**Date drafted:** 2026-07-09

---

## Why this is mostly a mirror, not a rebuild

The codebase is already Plaid-shaped:

- `bank_connections` already has `PROVIDER_PLAID`, a `.plaid` scope, and `plaid?` —
  Plaid connections live in the **same table** as Teller (`app/models/bank_connection.rb`).
- `financial_transactions` schema is Plaid-native: `plaid_id` (dedup key), `plaid_name`
  (fed to category prediction), `amount`, `source`, `raw_data` jsonb.
- `Finances::Predictions#predict_new_transactions` runs after **every** sync on all new
  rows regardless of source — so categorization is automatic the moment Plaid rows land.
- **Amount sign matches**: existing Amex data stores spends **positive**, refunds
  **negative** — identical to Plaid. Direct passthrough, no flip. (Still verify on first sync.)

So the work = a `Plaid::API` lib that mirrors `Teller::API`, a Link page that mirrors
`TellerRepairPage`, two small endpoints, and env vars.

---

## Prerequisites (one-time, ~1 day incl. Plaid's OAuth provisioning)

1. **Sign up at dashboard.plaid.com** → auto-approved onto the **Trial plan** (free, real
   data, 10 items, Amex on the OAuth list). Use your own name where it asks for a company /
   legal entity. LEI enforcement is stayed — skip.
2. Grab **`PLAID_CLIENT_ID`** + **`PLAID_SECRET`** from the dashboard.
3. Confirm American Express shows as available/OAuth-enabled (goes live ~6–24h after signup).
4. Add to `~/jarvis/jarvis.env` on the box (and `jarvis.env.template`):
   ```
   PLAID_CLIENT_ID=...
   PLAID_SECRET=...
   PLAID_ENV=production        # Trial runs on the production base URL, NOT sandbox/development
   ```

---

## Backend (Rails) — mirror the Teller path

**Add the gem** (`Gemfile`): `gem 'plaid', '~> 34'` (official SDK; handles link-token,
token exchange, `/transactions/sync`). `bundle install`, rebuild image.

**New: `app/lib/plaid/api.rb`** — mirror of `teller/api.rb`:
- `sync_all_transactions` → `BankConnection.active.plaid.each { |b| sync_transactions_for_bank(b) }`
- `sync_transactions_for_bank(bank)`:
  - Call **`/transactions/sync`** with `access_token = bank.token`, paginating on
    `next_cursor` until `has_more == false`. (Recommended over `/transactions/get`: clean
    initial backfill + incremental, and it returns `added/modified/removed`.)
  - Store the cursor in a new `bank_connections.transactions_cursor` column (migration below).
    Null cursor on first run = full backfill → fills the Jun 22→today Amex gap automatically.
  - For each `added`/`modified` txn where `pending == false`:
    `f = FinancialTransaction.find_or_initialize_by(plaid_id: txn.transaction_id)`
    `next if f.reviewed?`
    `f.transacted_at = txn.date; f.plaid_name = txn.merchant_name || txn.name;`
    `f.amount = txn.amount; f.source = bank.name; f.raw_data = txn.to_hash; f.save!`
  - Write a `BankSyncLog` row (same shape as Teller) — reuse the existing error pipeline.
- **Endpoints for Link** (new `app/controllers/plaid_controller.rb` + routes):
  - `POST /plaid/link_token` → `link/token/create` (products: `["transactions"]`,
    country_codes `["US"]`, `redirect_uri` for OAuth, user id). Returns `link_token`.
  - `POST /plaid/exchange` → `item/public_token/exchange(public_token)` → get `access_token`
    + `item_id`; call `/accounts/get` to grab the Amex `account_id`; upsert a
    `bank_connections` row: `provider='plaid'`, `name='amex'`, `token=access_token`,
    `account_id=<amex account>`, `is_active=true`.

**Wire into the existing job** — `app/jobs/sync_transactions_for_banks.rb`:
```ruby
def self.perform
  Teller::API.new.sync_all_transactions
  Plaid::API.new.sync_all_transactions      # <-- add
  Finances::Predictions.new.predict_new_transactions
end
```
No new cron needed; the 3-hour schedule already covers it. Predictions already run after.

**Migration** — `AddTransactionsCursorToBankConnections`: add `transactions_cursor :text`.
(Follow repo migration conventions.)

---

## Frontend (React/Vite) — new Plaid Link page

**New: `client/src/pages/PlaidConnectPage.tsx`** — mirror of `TellerRepairPage.tsx`:
- Load `https://cdn.plaid.com/link/v2/stable/link-initialize.js`.
- On mount: `POST /plaid/link_token` → get `link_token`.
- `Plaid.create({ token: link_token, onSuccess: (public_token) => POST /plaid/exchange })`.
- OAuth institutions require an **allowed redirect URI** registered in the Plaid dashboard
  (e.g. `https://finances.sifxtre.me/plaid-oauth`) + an OAuth return route.
- Add a nav link / route for `/plaid-connect`.

Deploy = push to `master` (Netlify auto-build), same as the `products` fix.

---

## Cutover (once Plaid Amex syncs cleanly)

1. Connect Amex via the Link page → creates the `provider='plaid'` amex row.
2. **First sync backfills** Jun 22→today (null cursor = full history). Verify the gap filled
   and **spot-check 3 known charges for correct amount + sign** before trusting totals.
3. **Deactivate the dead Teller Amex row**: `UPDATE bank_connections SET is_active=false WHERE id=8;`
   (stops the every-3-hour `enrollment.disconnected` errors). Keep `source='amex'` on both so
   history stays continuous.
4. Optional: retire the Teller-Amex alert noise.

---

## Gotchas (ranked)

1. **Amount sign** — verified matching today (spend +, refund −), but re-verify on the first
   real sync against known charges. A silent flip corrupts every total.
2. **pending vs posted** — only ingest `pending == false` (mirrors Teller's `posted` filter).
   Plaid emits a row when pending, then again when posted with a *different* `transaction_id`;
   filtering to posted-only keeps `plaid_id` stable and avoids dupes.
3. **PLAID_ENV = production** for the Trial plan (the old free "development" env was removed).
4. **OAuth redirect URI** must be registered in the Plaid dashboard or Amex OAuth won't open.
5. **LEI**: put your own name; enforcement stayed past July 2026.
6. **Trial cap = 10 items** — fine (Amex + maybe Chase). If Plaid nudges to paid, it's
   pay-as-you-go, pennies/item/month.

---

## Effort

- Backend (`Plaid::API` + 2 endpoints + migration + job wire): ~3–4 hrs.
- Frontend (Link page + OAuth route): ~2 hrs.
- Plaid signup + Amex OAuth provisioning: ~1 day of *waiting* (async), ~15 min of *doing*.
- One-time OAuth connect by you: ~2 min.

**Net:** ~half a day of build, one short OAuth click, then hands-off automatic Amex sync.
