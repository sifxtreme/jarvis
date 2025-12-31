# Jarvis

Personal finance tracking and automation platform.

## Features

- **Transaction Sync** - Automatically syncs credit card transactions from banks via Teller API (every 3 hours)
- **Smart Categorization** - ML-based prediction of transaction categories and merchant names based on history
- **Budget Tracking** - Track spending against budgets with visualizations
- **Email Summaries** - Daily email with credit card balance summaries
- **Transaction Search** - Search and filter through financial transactions

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
| Frontend | React 18, Vite, TailwindCSS, Radix UI | Netlify (auto-deploy) |

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

## Services & Integrations

### [Teller](docs/teller.md) (Primary)

Bank transaction sync via Teller API. Uses mTLS authentication.

- **Supported banks:** Chase, Amex, Bank of America, Citi, Capital One, 5000+ others
- **Troubleshooting:** See [docs/teller.md](docs/teller.md) for fixing "enrollment disconnected" errors

### [Plaid](docs/plaid.md) (Legacy)

Original bank integration, being phased out in favor of Teller.

## Deployment

### Frontend (Netlify)

Auto-deploys on push to `master`.

- **Config:** [`netlify.toml`](netlify.toml)
- **Build:** `npm run build`
- **Publish:** `client/dist`

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
```

## Environment Variables

Create `jarvis.env`:

```bash
QUEUE=*
RAILS_ENV=development

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

## Documentation

- [Teller Integration](docs/teller.md) - Bank sync, troubleshooting, repair tool
- [Plaid Integration](docs/plaid.md) - Legacy bank integration
- [Backend README](backend/README.md) - Rails API details
- [Frontend README](finance-tracker-app/README.md) - React app details

## Development

### Useful Commands

```bash
# Backend console
docker-compose run api rails console

# Run specific job manually
docker-compose run api rails runner "SyncTransactionsForBanks.perform"

# View logs
docker-compose logs -f api
docker-compose logs -f worker
```

### Admin Interfaces

- **Resque:** http://localhost:3000/resque - Job queue monitoring
- **API:** http://localhost:3000 - Rails API

## License

MIT
