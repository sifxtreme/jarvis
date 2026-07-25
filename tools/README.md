# Finance Tools

Monthly finance management toolkit for transaction categorization and tracking.

## What This Does

1. **Find missing transactions** - Identifies recurring transactions you may have forgotten to enter
2. **Categorize Amazon** - Auto-categorizes Amazon purchases by scraping order details
3. **Add manual transactions** - SDK for quickly adding income, bills, and other manual entries
4. **Monthly summaries** - Spending breakdown by category

## Quick Start

```bash
cd /Users/asifahmed/code/experiments/finance-tools

# Check what's missing this month
node finance-api.mjs missing-days 12

# See uncategorized Amazon transactions
node finance-api.mjs uncategorized-amazon 2025

# Get monthly spending summary
node finance-api.mjs summary 2025 12
```

## Documentation

| Doc | Purpose |
|-----|---------|
| **[FINANCE_RUNBOOK.md](./FINANCE_RUNBOOK.md)** | Complete monthly workflow - start here |
| [CATEGORIZATION_RULES.md](./CATEGORIZATION_RULES.md) | Amazon auto-categorization keywords |

## Key Scripts

| Script | Purpose |
|--------|---------|
| `finance-api.mjs` | **SDK** - Primary tool for all finance operations |
| `scrape-amazon-transactions.mjs` | Scrape Amazon payments via Playwright |
| `match-amazon-transactions.mjs` | Match Amazon orders to finance tracker |
| `lookup-orders.mjs` | Look up Amazon item details + auto-categorize |
| `update-amazon-transactions.mjs` | Push Amazon categorizations to API |

## SDK Commands

```bash
node finance-api.mjs list [year] [month]           # List transactions
node finance-api.mjs missing [month] [manual]      # Find missing recurring
node finance-api.mjs missing-days [month]          # Missing with typical day-of-month
node finance-api.mjs uncategorized-amazon [year]   # Uncategorized Amazon
node finance-api.mjs summary [year] [month]        # Spending by category
```

## API

- **URL**: `https://sifxtre.me/api/financial_transactions`
- **Auth**: `Authorization: ENTAROTASSADAR`
- **Frontend**: https://finances.sifxtre.me

## Related

- **Jarvis**: `/Users/asifahmed/code/experiments/jarvis/` (API backend + React frontend)
- **parents-finances**: `/Users/asifahmed/code/experiments/parents-finances/` (what mom/dad owe Asif; reconciles against Jarvis)
- **Interop map** (Jarvis ↔ parents-finances ↔ personal email inbox — the bill lifecycle + what's wired): [`forge-bot/docs/PERSONAL_SYSTEMS_INTEROP.md`](../forge-bot/docs/PERSONAL_SYSTEMS_INTEROP.md)
