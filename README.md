# Jarvis

Personal finance tracker with automatic bank sync and spending insights.

## Features

### Transaction Management
- **Multi-Bank Sync** - Automatically syncs transactions from multiple banks via Teller API (every 3 hours)
- **Smart Categorization** - ML-based prediction of transaction categories and merchant names
- **Transaction Search** - Fast search with trigram indexing
- **Quick Add** - Easily add manual transactions (cash, Zelle, Venmo, etc.)

### Spending Insights
- **Trends Dashboard** - Month-over-month spending by category and merchant
- **Budget Tracking** - Track spending against budgets with visualizations
- **Missing Recurring Alerts** - Automatically detects recurring transactions that haven't hit yet

### Bank Integrations
- **Teller Repair Tool** - Built-in tool to fix disconnected bank connections (MFA)
- **Supported Banks** - Chase, Amex, Bank of America, Citi, Capital One, 5000+ others

### Jarvis Extensions (2026-01-02)
- **Slack Bot** — Screenshot + text ingestion for calendar events. See docs/features/SLACK_BOT.md.
- **Gemini Extraction** — Intent + extraction with cost logging. See docs/features/GEMINI_EXTRACTION.md.
- **Google Auth** — Google Sign-In + session auth for the API. See docs/features/GOOGLE_AUTH.md.
- **Calendar Sync** — Personal events + busy-only work calendars. See docs/features/CALENDAR_SYNC.md.
- **Calendar UI** — New /calendar page with day/week/2-week/month views. See docs/features/CALENDAR_UI.md.

## Architecture

```
jarvis/
├── backend/                 # Rails API + background workers
├── finance-tracker-app/     # React frontend (SPA)
├── teller/                  # Teller mTLS credentials (gitignored)
├── docs/                    # Documentation
└── docker-compose.yml       # Container orchestration
```

| Component | Tech Stack | Deployment |
|-----------|------------|------------|
| Backend | Rails 5.2, PostgreSQL 14, Redis, Resque | Docker (self-hosted) |
| Frontend | React 18, Vite, TailwindCSS, Radix UI, Recharts | Netlify (auto-deploy) |

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

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Transaction list with filters and search |
| `/trends` | Spending trends with charts (MoM by category/merchant) |
| `/yearly-budget` | Annual budget overview |
| `/teller-repair` | Fix disconnected bank enrollments |

## Bank Connections

The `bank_connections` table stores credentials for multiple bank accounts.

| Column | Description |
|--------|-------------|
| `name` | Bank identifier (e.g., "chase", "amex") - used as `source` on transactions |
| `token` | Access token from Teller |
| `provider` | "teller" or "plaid" |
| `account_id` | Teller account ID (acc_xxx) |
| `sync_from_date` | Only sync transactions after this date (nullable) |
| `is_active` | Whether to sync this bank |

### Adding a New Bank Connection

1. **Get Access Token** - Use the Teller Repair page (`/teller-repair`) to create a new enrollment
2. **Get Account ID** - Use the "Lookup Account ID" feature in the repair tool
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

## API Endpoints

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/financial_transactions` | List transactions with filters |
| POST | `/financial_transactions` | Create manual transaction |
| PUT | `/financial_transactions/:id` | Update transaction |
| GET | `/financial_transactions/trends` | Spending trends and aggregations |
| GET | `/financial_transactions/recurring_status` | Missing recurring transactions |

**Query Parameters:**
- `year` - Filter by year
- `month` - Filter by month
- `query` - Search category, merchant_name, plaid_name, or source
- `show_hidden` - "true" or "false"
- `show_needs_review` - "true" for unreviewed transactions

### Teller

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teller/accounts?token=xxx` | List accounts for a token |

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
```

Teller credentials (certificates) go in the `teller/` folder - see [docs/teller.md](docs/teller.md).

## Background Jobs

Jobs run via Resque. View status at `http://localhost:3000/resque`

| Job | Schedule | Description |
|-----|----------|-------------|
| `SyncTransactionsForBanks` | Every 3 hours | Fetch new transactions from Teller |
| `Finances::Predictions` | After sync | Predict categories for new transactions |

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

## Common Issues

**Transactions not syncing:**
1. Check `is_active: true` on bank connection
2. Check `sync_from_date` isn't filtering them out
3. Check transaction `status` is "posted"
4. Check logs: `docker-compose logs -f worker`

**Bank keeps disconnecting (especially Amex):**
- This is normal bank security behavior
- Use the Teller Repair page (`/teller-repair`) to reconnect
- Amex is particularly aggressive with MFA requirements

## Documentation

- [Teller Integration](docs/teller.md) - Bank sync, troubleshooting
- [Backend README](backend/README.md) - Rails API details
- [Frontend README](finance-tracker-app/README.md) - React app details

## License

MIT
