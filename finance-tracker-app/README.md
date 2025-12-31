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
│   │   │   ├── BudgetComparison.tsx
│   │   │   └── TransactionStats.tsx
│   │   ├── pages/            # Route pages
│   │   │   ├── TransactionsPage.tsx
│   │   │   └── YearlyBudgetPage.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and API client
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
- Filterable/sortable data table
- Date range filtering
- Category/merchant filtering
- Inline editing
- Transaction statistics

### Yearly Budget (`/budget`)

Budget tracking dashboard:
- Budget vs actual spending comparison
- Monthly breakdown
- Category-wise analysis
- Charts and visualizations

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

- `GET /financial_transactions` - List transactions
- `PUT /financial_transactions/:id` - Update transaction
- `GET /budgets` - List budgets

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
