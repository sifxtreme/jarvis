# Jarvis

Personal finance tracking and automation platform.

## Features

- **Multi-Bank Transaction Sync** - Automatically syncs credit card transactions from multiple banks via Teller API (every 3 hours)
- **Smart Categorization** - ML-based prediction of transaction categories and merchant names based on history
- **Budget Tracking** - Track spending against budgets with visualizations
- **Email Summaries** - Daily email with credit card balance summaries
- **Transaction Search** - Search and filter through financial transactions (with trigram indexing for fast ILIKE searches)

## Architecture

```
jarvis/
├── backend/                 # Rails API + background workers
├── finance-tracker-app/     # React frontend (SPA)
├── teller/                  # Teller mTLS credentials (gitignored)
├── docs/                    # Documentation
├── teller-repair.html       # Tool to repair disconnected bank enrollments
└── docker-compose.yml       # Container orchestration
```

| Component | Tech Stack | Deployment |
|-----------|------------|------------|
| Backend | Rails 5.2, PostgreSQL 14, Redis, Resque | Docker (self-hosted) |
| Frontend | React 18, Vite, TailwindCSS, Radix UI, Zustand | Netlify (auto-deploy) |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js (for frontend development)

### Backend
```bash
# Copy environment file
cp jarvis.env.example jarvis.env
# Edit with your secrets
vim jarvis.env

# Start all services
docker-compose up -d

# Run migrations
docker-compose run api rake db:migrate
```

### Frontend
```bash
cd finance-tracker-app
npm install
npm run dev  # http://localhost:3001
```

## Bank Connections

The `bank_connections` table stores credentials for multiple bank accounts across different providers.

| Column | Description |
|--------|-------------|
| `name` | Bank identifier (e.g., "chase", "amex") - used as `source` on transactions |
| `token` | Access token from Teller/Plaid |
| `provider` | "teller" or "plaid" |
| `account_id` | Teller account ID (acc_xxx) |
| `sync_from_date` | Only sync transactions after this date (nullable) |
| `is_active` | Whether to sync this bank |

### Adding a New Bank Connection

1. **Get Access Token** - Use `teller-repair.html` to create a new enrollment
2. **Get Account ID** - Use the "Lookup Account ID" feature in the repair tool, or:
   ```ruby
   api = Teller::API.new
   api.list_accounts('your_token')
   ```
3. **Add to Database:**
   ```ruby
   BankConnection.create!(
     name: 'chase',
     token: 'token_xxx',
     account_id: 'acc_xxx',
     provider: 'teller',
     sync_from_date: Date.today - 90.days,  # optional
     is_active: true
   )
   ```

## Services & Integrations

### [Teller](docs/teller.md) (Primary)

Bank transaction sync via Teller API. Uses mTLS authentication.

- **Supported banks:** Chase, Amex, Bank of America, Citi, Capital One, 5000+ others
- **Credentials:** Certificate + private key in `teller/` folder
- **Troubleshooting:** See [docs/teller.md](docs/teller.md) for fixing "enrollment disconnected" errors

#### Transaction Types Synced

All `posted` transactions are synced regardless of type. Common types include:
- `card_payment` - Credit/debit card purchases
- `transaction` - Generic transactions (used by Chase)
- `fee` - Bank fees
- `refund` - Refunds

#### Amex MFA Issues

American Express frequently requires re-authentication (MFA). This is an Amex security policy, not a bug. Solutions:

1. **Set up Teller webhooks** to get notified when enrollment disconnects
2. **Use the repair tool** (`teller-repair.html`) to quickly re-authenticate
3. **Consider Plaid for Amex** - they have OAuth integration which is more stable

### [Plaid](docs/plaid.md) (Legacy)

Original bank integration, still supported but being phased out in favor of Teller.

## API Endpoints

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/financial_transactions` | List transactions with filters |
| POST | `/financial_transactions` | Create manual transaction |
| PUT | `/financial_transactions/:id` | Update transaction (partial updates supported) |

**Query Parameters:**
- `year` - Filter by year
- `month` - Filter by month
- `query` - Search category, merchant_name, plaid_name, or source
- `show_hidden` - "true" or "false"
- `show_needs_review` - "true" for unreviewed transactions
- `include_raw_data` - "true" to include raw API response (large payload)

### Teller

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teller/accounts?token=xxx` | List accounts for a token (requires auth) |

## Deployment

### Frontend (Netlify)

Auto-deploys on push to `master`.

- **Config:** [`netlify.toml`](netlify.toml)
- **Build:** `npm run build`
- **Publish:** `finance-tracker-app/client/dist`

### Backend (Docker)

Self-hosted via Docker Compose. Services:
- `api` - Rails server (port 3000)
- `worker` - Resque background job processor
- `scheduler` - Resque scheduler (cron jobs)
- `db` - PostgreSQL 14
- `redis` - Redis (job queue + cache)

```bash
# Deploy updates
git pull
docker-compose build api
docker-compose up -d
docker-compose run api rake db:migrate
```

## Environment Variables

Create `jarvis.env`:

```bash
QUEUE=*
RAILS_ENV=development

# API Authentication
JARVIS_RAILS_PASSWORD=your-secret-password

# Email (for daily summaries)
JARVIS_GMAIL_EMAIL=your-email@gmail.com
JARVIS_GMAIL_PASSWORD=app-password

# Plaid (legacy)
JARVIS_PLAID_CLIENT_ID=xxx
JARVIS_PLAID_CLIENT_SECRET=xxx
```

Teller credentials (certificates) go in the `teller/` folder - see [docs/teller.md](docs/teller.md).

## Background Jobs

Jobs run via Resque. View status at `http://localhost:3000/resque`

| Job | Schedule | Description |
|-----|----------|-------------|
| `SyncTransactionsForBanks` | Every 3 hours | Fetch new transactions from Teller |
| `Finances::Predictions` | After sync | Predict categories for new transactions |

## Database

### Key Tables

- `financial_transactions` - All synced and manual transactions
- `bank_connections` - Bank credentials and settings
- `budgets` - Budget definitions

### Indexes

The following indexes optimize common queries:

- **Sorting:** `(transacted_at DESC, id DESC)`
- **Year/Month filtering:** Functional indexes on `EXTRACT(year/month FROM transacted_at)`
- **Search:** Trigram (GIN) indexes on `merchant_name`, `plaid_name`, `category` for fast ILIKE
- **Source filtering:** Index on `source`
- **Amortization:** GIN index on `amortized_months` array

### Finding Duplicates

```sql
SELECT
  amount,
  DATE(transacted_at) as txn_date,
  COALESCE(merchant_name, plaid_name) as name,
  COUNT(*) as count,
  ARRAY_AGG(id ORDER BY id) as ids
FROM financial_transactions
GROUP BY amount, DATE(transacted_at), COALESCE(merchant_name, plaid_name)
HAVING COUNT(*) > 1
ORDER BY count DESC, txn_date DESC;
```

## Debugging

### Check Teller API Transactions

```ruby
api = Teller::API.new
bank = BankConnection.find_by(name: 'chase')
raw = api.send(:fetch_transactions, bank)

# View transaction types
raw.map { |t| t['type'] }.uniq

# View statuses
raw.group_by { |t| t['status'] }.transform_values(&:count)

# List recent transactions
raw.sort_by { |t| t['date'] }.reverse.first(20).each do |t|
  name = t.dig('details', 'counterparty', 'name') || t['description'] || 'N/A'
  in_db = FinancialTransaction.exists?(plaid_id: t['id']) ? '✓' : '✗'
  puts "#{in_db} #{t['date']} | $#{t['amount'].to_s.rjust(8)} | #{name.to_s[0,30]}"
end
```

### Check What's Missing from DB

```ruby
# Get IDs of transactions that should have synced
ids = raw.filter { |t|
  t['status'] == 'posted' &&
  (bank.sync_from_date.nil? || Date.parse(t['date']) > bank.sync_from_date)
}.map { |t| t['id'] }

# How many exist?
FinancialTransaction.where(plaid_id: ids).count

# How many are reviewed (won't be updated on re-sync)?
FinancialTransaction.where(plaid_id: ids, reviewed: true).count

# What sources do they have?
FinancialTransaction.where(plaid_id: ids).group(:source).count
```

### Common Issues

**Transactions not syncing:**
1. Check `is_active: true` on bank connection
2. Check `sync_from_date` isn't filtering them out
3. Check transaction `status` is "posted"
4. Check logs: `docker-compose logs -f worker`

**Search not finding transactions:**
- Search covers: `category`, `merchant_name`, `plaid_name`, `source`
- Check the `source` value matches what you're searching

**Amex keeps disconnecting:**
- This is normal Amex behavior
- Use `teller-repair.html` to reconnect
- Consider setting up Teller webhooks for `enrollment.disconnected` events

## Documentation

- [Teller Integration](docs/teller.md) - Bank sync, troubleshooting, repair tool
- [Plaid Integration](docs/plaid.md) - Legacy bank integration
- [Backend README](backend/README.md) - Rails API details
- [Frontend README](finance-tracker-app/README.md) - React app details
- [UX Improvements](finance-tracker-app/UX_IMPROVEMENTS.md) - Future enhancement ideas

## Development

### Useful Commands

```bash
# Backend console
docker-compose run api rails console

# Run specific job manually
docker-compose run api rails runner "SyncTransactionsForBanks.perform"

# Sync a specific bank
docker-compose run api rails runner "Teller::API.new.sync_transactions_for_bank(BankConnection.find_by(name: 'chase'))"

# View logs
docker-compose logs -f api
docker-compose logs -f worker
```

### Admin Interfaces

- **Resque:** http://localhost:3000/resque - Job queue monitoring
- **API:** http://localhost:3000 - Rails API

## Teller Repair Tool

The `teller-repair.html` file is a standalone tool for managing Teller enrollments:

1. **Repair disconnected enrollments** - Re-authenticate when MFA is required
2. **Create new enrollments** - Connect new bank accounts
3. **Lookup account IDs** - Find the `acc_xxx` ID for a token (requires deployed API)

To use:
```bash
# Serve locally
python3 -m http.server 8080
# Open http://localhost:8080/teller-repair.html
```

Or access via your deployed frontend.

## License

MIT
