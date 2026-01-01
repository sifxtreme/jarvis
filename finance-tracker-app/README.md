# Jarvis Finance Tracker Frontend

React SPA for viewing and managing financial transactions.

## Tech Stack

- **Framework:** React 18
- **Build:** Vite
- **Styling:** TailwindCSS
- **Components:** Radix UI + shadcn/ui patterns
- **State:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Routing:** React Router v7
- **Charts:** Recharts
- **Forms:** React Hook Form

## Project Structure

```
finance-tracker-app/
├── client/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── ui/           # Reusable UI primitives (shadcn)
│   │   │   ├── TransactionTable.tsx
│   │   │   ├── TransactionModal.tsx
│   │   │   ├── FilterControls.tsx
│   │   │   ├── RecurringStatusCard.tsx
│   │   │   ├── SplitTransactionModal.tsx
│   │   │   └── TransactionStats.tsx
│   │   ├── pages/            # Route pages
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── TrendsPage.tsx
│   │   │   └── YearlyBudgetPage.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and API client
│   │   │   ├── api.ts        # API client with types
│   │   │   └── utils.ts      # Shared utilities (YEARS, formatCurrency, etc.)
│   │   ├── App.tsx           # Main app with routing
│   │   └── main.tsx          # Entry point
│   ├── index.html
│   └── public/
├── netlify.toml              # Netlify deployment config
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

## Pages

### Transactions (`/`)

Main transaction list with:
- Filterable/sortable data table with year/month navigation
- Search across merchant names and categories
- Inline editing via modal
- Transaction statistics sidebar with budget comparison
- Recurring transaction detection and quick-add
- Visual indicators for non-budgeted categories (orange + alert icon)
- Merchant icons for common brands (Amazon, Target, Netflix, etc.)
- Amortized expense support (spread across months)

### Trends (`/trends`)

Comprehensive spending analytics:
- Monthly spending chart with 3-month moving average
- Year-over-year comparison metrics
- Spending by Category (month-over-month line chart)
- Spending by Merchant (filterable by category)
- Category and Merchant breakdown pie/bar charts
- Per-budget category tracking with variance indicators
- "Other" aggregation for non-budgeted spending
- Exportable data

### Yearly Budget (`/budget`)

Budget tracking dashboard:
- Monthly summary (income, expenses, savings, savings rate)
- Budget vs actual grid with all months
- Click-through to transaction details per category/month
- Display modes: actual amount, variance, percentage
- Column visibility controls

## Development

### Setup

```bash
npm install
npm run dev
```

Runs on http://localhost:3001

### Build

```bash
npm run build
```

Output: `client/dist/`

### Preview Production Build

```bash
npm run preview
```

## API Integration

The frontend connects to the Rails backend API.

### Configuration

API base URL is configured in the lib folder. For local development, ensure the backend is running on port 3000.

### Endpoints Used

- `GET /financial_transactions` - List transactions (with year/month/query filters)
- `POST /financial_transactions` - Create transaction
- `PUT /financial_transactions/:id` - Update transaction
- `DELETE /financial_transactions/:id` - Delete transaction
- `GET /financial_transactions/trends` - Trends analytics data
- `GET /financial_transactions/recurring_status` - Recurring transaction detection
- `GET /budgets` - List budgets

## Key Utilities

### `utils.ts`

```typescript
// Year filter options - update annually
export const YEARS = [2026, 2025, 2024, 2023] as const;

// Currency formatting
formatCurrency(1234.56)      // "$1,234.56"
formatCurrencyDollars(1234)  // "1,234"

// Date formatting (handles timezone)
formatDate("2024-01-15T00:00:00Z")  // "2024-01-15"
```

### `api.ts`

- `OTHER_CATEGORY = "Other"` - Constant for non-budgeted category aggregation
- Type definitions for Transaction, Budget, TrendsData, etc.

## Components

### UI Components (`components/ui/`)

Reusable primitives built on Radix UI:
- Button, Input, Select
- Dialog, Sheet, Popover
- Table, Tabs
- Toast notifications

### Feature Components

| Component | Description |
|-----------|-------------|
| `TransactionTable` | Main data grid with sorting/filtering |
| `TransactionModal` | Create/edit transaction dialog |
| `FilterControls` | Date, category, merchant filters |
| `TransactionStats` | Summary statistics cards |
| `BudgetComparison` | Budget vs actual charts |
| `SplitTransactionModal` | Split transaction across months |

## State Management

### Zustand Stores

Global state for:
- Filter preferences
- View settings
- UI state

### React Query

Server state management:
- Automatic caching
- Background refetching
- Optimistic updates

## Deployment

### Netlify (Production)

Auto-deploys on push to `master`.

Configuration in `netlify.toml`:
```toml
[build]
  base = "finance-tracker-app"
  command = "npm run build"
  publish = "client/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Manual Deploy

```bash
npm run build
# Upload client/dist/ to any static host
```

## Styling

### TailwindCSS

Utility-first CSS with custom config in `tailwind.config.ts`.

### Path Aliases

`@/` maps to `./client/src/` for clean imports:

```typescript
import { Button } from "@/components/ui/button"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3001) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
