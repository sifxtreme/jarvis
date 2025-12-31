# Jarvis Backend

Rails 5.2 API server with Resque background job processing.

## Tech Stack

- **Framework:** Rails 5.2 (API mode)
- **Database:** PostgreSQL 14
- **Job Queue:** Redis + Resque
- **Scheduler:** resque-scheduler

## Project Structure

```
backend/
├── app/
│   ├── controllers/          # API endpoints
│   │   ├── financial_transactions_controller.rb
│   │   └── budgets_controller.rb
│   ├── models/               # ActiveRecord models
│   │   ├── financial_transaction.rb
│   │   ├── budget.rb
│   │   └── plaid_bank.rb
│   ├── jobs/                 # Resque background jobs
│   │   └── sync_transactions_for_banks.rb
│   └── lib/                  # Service classes
│       ├── teller/api.rb     # Teller API client
│       ├── plaid_service/api.rb
│       └── finances/predictions.rb
├── config/
│   └── resque_schedule.yml   # Cron job definitions
├── db/
│   └── migrate/              # Database migrations
└── scripts/                  # Utility scripts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/financial_transactions` | List transactions (with filters) |
| POST | `/financial_transactions` | Create transaction |
| PUT | `/financial_transactions/:id` | Update transaction |
| GET | `/budgets` | List budgets |
| GET | `/resque` | Resque admin UI |

## Models

### FinancialTransaction

Core model for bank transactions.

| Field | Type | Description |
|-------|------|-------------|
| `plaid_id` | string | Unique ID from Teller/Plaid |
| `plaid_name` | string | Raw merchant name from API |
| `merchant_name` | string | Cleaned merchant name |
| `category` | string | Transaction category |
| `amount` | decimal | Transaction amount |
| `source` | string | Bank source (e.g., "amex") |
| `transacted_at` | datetime | Transaction date |
| `reviewed` | boolean | Manually reviewed flag |
| `hidden` | boolean | Hidden from reports |
| `raw_data` | jsonb | Raw API response |

### Budget

Budget tracking model.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Budget name |
| `amount` | decimal | Budget amount |
| `expense_type` | string | "expense" or "income" |
| `valid_starting_at` | date | Budget start date |

## Background Jobs

### SyncTransactionsForBanks

Syncs transactions from Teller API.

- **Queue:** `high`
- **Schedule:** Every 3 hours (`0 */3 * * *`)
- **Flow:**
  1. Fetch transactions from Teller API
  2. Filter by type (card_payment, refund) and status (posted)
  3. Store new transactions in database
  4. Run prediction on uncategorized transactions

### Manual Execution

```bash
# Via Docker
docker-compose run api rails runner "SyncTransactionsForBanks.perform"

# Via Rails console
docker-compose run api rails console
> SyncTransactionsForBanks.perform
```

## Service Classes

### Teller::API (`app/lib/teller/api.rb`)

Teller bank integration using mTLS authentication.

```ruby
api = Teller::API.new
api.sync_all_transactions
```

**Note:** Currently hardcoded to single Amex account. See [docs/teller.md](../docs/teller.md) for details.

### Finances::Predictions (`app/lib/finances/predictions.rb`)

ML-based category and merchant name prediction.

```ruby
predictions = Finances::Predictions.new
predictions.predict_new_transactions
```

Predicts based on historical transaction patterns (>50% match threshold).

## Development

### Setup

```bash
# With Docker (recommended)
docker-compose up -d
docker-compose run api rake db:create db:migrate

# Without Docker
bundle install
rails db:create db:migrate
rails server
```

### Rails Console

```bash
docker-compose run api rails console
```

### Running Tests

```bash
docker-compose run api rails test
```

### Database Migrations

```bash
# Create migration
docker-compose run api rails generate migration AddFieldToModel field:type

# Run migrations
docker-compose run api rake db:migrate

# Rollback
docker-compose run api rake db:rollback
```

## Configuration

### Environment Variables

Set in `jarvis.env` (root directory):

```bash
RAILS_ENV=development
QUEUE=*

# Email
JARVIS_GMAIL_EMAIL=xxx
JARVIS_GMAIL_PASSWORD=xxx

# Plaid (legacy)
JARVIS_PLAID_CLIENT_ID=xxx
JARVIS_PLAID_CLIENT_SECRET=xxx
```

### Resque Schedule

Defined in `config/resque_schedule.yml`:

```yaml
transactions_syncer:
  cron: "0 */3 * * *"
  class: "SyncTransactionsForBanks"
  queue: high
  description: "Sync Transactions from Teller"
```

## Docker

### Build

```bash
docker build -t jarvis-rails .

# For ARM Macs deploying to x86 servers
docker buildx build --platform linux/amd64 -t jarvis-rails .
```

### Services

Via `docker-compose.yml` in root:

- `api` - Rails server
- `worker` - Resque worker (`bundle exec rake resque:work`)
- `scheduler` - Resque scheduler (`bundle exec rake resque:scheduler`)
- `db` - PostgreSQL
- `redis` - Redis

## Debugging

### Resque Admin

Access at http://localhost:3000/resque

- View queues and jobs
- Retry failed jobs
- Monitor workers

### Logs

```bash
docker-compose logs -f api
docker-compose logs -f worker
```

### Common Issues

**"Enrollment is not healthy" error**

See [docs/teller.md](../docs/teller.md) - bank connection needs re-authentication.
