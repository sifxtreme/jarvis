# Jarvis: TypeScript Rewrite Analysis

> Pie in the sky exploration: What if we rewrote the Rails backend as a modern TypeScript app?

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Why TypeScript for AI-Assisted Development?](#why-typescript-for-ai-assisted-development)
4. [Proposed Stack](#proposed-stack)
5. [Rails vs TypeScript Comparison](#rails-vs-typescript-comparison)
6. [Deployment Options](#deployment-options)
7. [Migration Path](#migration-path)
8. [Code Examples](#code-examples)
9. [Risks & Considerations](#risks--considerations)
10. [Recommendation](#recommendation)

---

## Executive Summary

**The Question:** Should Jarvis's Rails 5.2 backend be rewritten in TypeScript for better AI-assisted development?

**The Answer:** Yes, but with caveats.

### Key Findings

| Factor | Rails | TypeScript |
|--------|-------|------------|
| **AI Readability** | Good | Excellent |
| **LLM Training Data** | Limited | Abundant |
| **Type Safety** | Runtime only | Compile-time |
| **Feedback Loop** | Slow (run to see errors) | Instant (IDE + tsc) |
| **Your Familiarity** | Less familiar | Very familiar (Cerebro) |
| **Deployment Simplicity** | Same (Docker) | Same (Docker) |
| **Rewrite Effort** | N/A | ~1 weekend |

**Bottom line:** Your Rails backend is ~500 lines of actual business logic. The rewrite is tractable, and TypeScript offers meaningful advantages for AI-assisted development.

---

## Current State Analysis

### What You Have

```
backend/
├── 52 Ruby files total
├── ~500 lines of actual business logic
├── Rails 5.2.1 (released 2018, EOL)
├── PostgreSQL (keep this)
├── Resque + Redis (jobs)
└── 7 unpatched security vulnerabilities (needs Rails upgrade anyway)
```

### Actual Features to Port

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Transaction CRUD** | Low | 1 controller, basic queries |
| **Bank Sync (Teller)** | Medium | mTLS, API calls, upsert logic |
| **Bank Sync (Plaid)** | Medium | Similar pattern |
| **Predictions** | Low | ML categorization |
| **Budget CRUD** | Low | Basic CRUD |
| **Email Summaries** | Low | Cron + mailer |
| **Background Jobs** | Medium | Resque → BullMQ |

**Reality check:** This is a small app. The Rails "magic" you're using is minimal:
- ActiveRecord (→ Drizzle ORM)
- Resque (→ BullMQ)
- Basic routing (→ Fastify)
- CORS/Auth middleware (→ Fastify plugins)

---

## Why TypeScript for AI-Assisted Development?

### The Core Argument

> "The combination of TypeScript's structural typing and LLM pattern recognition creates something special. When you encode meaning into types, you're not just preventing bugs — you're teaching the model your domain's language."
>
> — [Thomas Landgraf, "Why I Choose TypeScript for LLM-Based Coding"](https://medium.com/@tl_99311/why-i-choose-typescript-for-llm-based-coding-19cbb19f3fa2)

### Training Data Abundance

LLMs are trained predominantly on public code. Here's the reality:

| Language | GitHub Repos | % of Training Data | LLM Fluency |
|----------|--------------|-------------------|-------------|
| JavaScript/TypeScript | #1 | ~20-25% | Excellent |
| Python | #2 | ~15-20% | Excellent |
| Ruby | #10 | ~2-3% | Good |

**What this means:** Claude has seen vastly more TypeScript patterns than Ruby patterns. It's more likely to generate idiomatic, bug-free TypeScript.

### The Feedback Loop Advantage

```
┌─────────────────────────────────────────────────────────────┐
│                    RUBY FEEDBACK LOOP                        │
├─────────────────────────────────────────────────────────────┤
│  Write code → Run app → Hit endpoint → See runtime error    │
│                                                              │
│  Time to feedback: 5-30 seconds                              │
│  Error quality: Stack trace, often cryptic                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 TYPESCRIPT FEEDBACK LOOP                     │
├─────────────────────────────────────────────────────────────┤
│  Write code → Instant red squiggly in IDE                    │
│                                                              │
│  Time to feedback: <1 second                                 │
│  Error quality: "Property 'foo' does not exist on type..."  │
└─────────────────────────────────────────────────────────────┘
```

For AI-assisted development, this matters enormously:

> "In LLM-based coding, the model needs authoritative, parseable truth inside the repository. Every branded type is a semantic checkpoint that guides the LLM toward correct solutions. Every test is executable documentation that shows intended behavior."
>
> — [TypeScript & LLMs: Lessons Learned from 9 Months in Production](https://johnchildseddy.medium.com/typescript-llms-lessons-learned-from-9-months-in-production-4910485e3272)

### Self-Documenting Types

```typescript
// Ruby: What does this return? Run it and find out!
def sync_transactions_for_bank(bank)
  # ...
end

// TypeScript: The signature IS documentation
async function syncTransactionsForBank(
  bank: BankConnection
): Promise<{ synced: number; skipped: number; errors: string[] }> {
  // ...
}
```

The LLM can read the types and understand:
- What goes in
- What comes out
- What can go wrong

---

## Proposed Stack

### The Modern TypeScript Backend Stack (2025)

```
┌─────────────────────────────────────────────────────────────┐
│                        PROPOSED STACK                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Framework:    Fastify 5.x (2-4x faster than Express)       │
│   ORM:          Drizzle (SQL-first, minimal overhead)        │
│   Database:     PostgreSQL 14+ (keep existing)               │
│   Queues:       BullMQ 5.x + Redis (keep existing Redis)     │
│   Validation:   Zod (runtime + compile-time)                 │
│   HTTP Client:  undici (built into Node 18+)                 │
│   Runtime:      Node.js 22 LTS                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why These Choices?

#### Fastify over Express/NestJS

> "Fastify is up to 2-4x faster than Express... capable of serving up to 30,000 requests per second."
>
> — [Fastify Official Docs](https://fastify.dev/)

| Framework | RPS | TypeScript | Bundle Size |
|-----------|-----|------------|-------------|
| Express | ~20k | Bolted on | Medium |
| Fastify | ~115k | First-class | Small |
| NestJS | ~15k | First-class | Large |

For a personal project, Fastify's simplicity wins. NestJS is overkill.

#### Drizzle over Prisma/TypeORM

> "Drizzle is currently the fastest ORM for Node.js apps in 2025. It compiles queries down to SQL with minimal overhead."
>
> — [Best ORM for NestJS in 2025](https://dev.to/sasithwarnakafonseka/best-orm-for-nestjs-in-2025-drizzle-orm-vs-typeorm-vs-prisma-229c)

| ORM | Philosophy | Bundle Size | Serverless-Ready |
|-----|------------|-------------|------------------|
| Prisma | Schema-first DSL | Large | No (binary) |
| TypeORM | Entity decorators | Medium | Yes |
| Drizzle | SQL-first TypeScript | Tiny (7kb) | Yes |

**Key advantage:** No code generation step. Change schema → types update instantly.

```typescript
// Drizzle: Schema IS TypeScript
export const bankConnections = pgTable('bank_connections', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  accountId: varchar('account_id', { length: 255 }),
  syncFromDate: date('sync_from_date'),
  isActive: boolean('is_active').default(true),
});

// Type is automatically inferred
type BankConnection = typeof bankConnections.$inferSelect;
```

#### BullMQ over Agenda/Bree

> "BullMQ is the leader in the Node.js ecosystem for background jobs... built on Redis with exactly-once semantics and horizontal scaling."
>
> — [BullMQ Official Docs](https://bullmq.io/)

Perfect 1:1 replacement for Resque:
- Same Redis backend
- Priority queues ✓
- Scheduled jobs ✓
- Retries with backoff ✓
- Web UI (Bull Board) ✓

---

## Rails vs TypeScript Comparison

### Side-by-Side: The Same Feature

#### Transaction List Endpoint

**Rails (Current)**
```ruby
# app/controllers/financial_transactions_controller.rb
class FinancialTransactionsController < ApplicationController
  def index
    year = params[:year]
    month = params[:month]
    query = params[:query]

    db_query = FinancialTransaction.select(columns).all
    db_query = db_query.where('extract(year from transacted_at) = ?', year) if year
    db_query = db_query.where('extract(month from transacted_at) = ?', month) if month
    db_query = db_query.where('category ilike ?', "%#{query}%") if query

    render json: { results: db_query }
  end
end
```

**TypeScript (Proposed)**
```typescript
// src/routes/transactions.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { financialTransactions } from '../db/schema';
import { eq, ilike, sql, and } from 'drizzle-orm';

const querySchema = z.object({
  year: z.coerce.number().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  query: z.string().optional(),
  showHidden: z.enum(['true', 'false']).optional(),
});

export async function transactionRoutes(app: FastifyInstance) {
  app.get('/financial_transactions', async (request, reply) => {
    const { year, month, query, showHidden } = querySchema.parse(request.query);

    const conditions = [];
    if (year) conditions.push(sql`extract(year from ${financialTransactions.transactedAt}) = ${year}`);
    if (month) conditions.push(sql`extract(month from ${financialTransactions.transactedAt}) = ${month}`);
    if (query) conditions.push(ilike(financialTransactions.category, `%${query}%`));
    if (showHidden === 'false') conditions.push(eq(financialTransactions.hidden, false));

    const results = await db
      .select()
      .from(financialTransactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`transacted_at DESC, id DESC`);

    return { results };
  });
}
```

#### Bank Sync Job

**Rails (Current)**
```ruby
# app/lib/teller/api.rb
def sync_transactions_for_bank(bank)
  raw_transactions = fetch_transactions(bank)

  filtered = raw_transactions.filter do |trx|
    trx['status'] == 'posted' &&
    (bank.sync_from_date.nil? || Date.parse(trx['date']) > bank.sync_from_date)
  end

  filtered.each do |trx|
    f = FinancialTransaction.find_or_initialize_by(plaid_id: trx['id'])
    next if f.reviewed?

    f.transacted_at = trx['date']
    f.plaid_name = trx['description']
    f.amount = trx['amount'].to_f
    f.source = bank.name
    f.save!
  end
end
```

**TypeScript (Proposed)**
```typescript
// src/services/teller.ts
import { db } from '../db';
import { financialTransactions, bankConnections } from '../db/schema';
import { eq } from 'drizzle-orm';

interface TellerTransaction {
  id: string;
  status: 'posted' | 'pending';
  date: string;
  amount: string;
  description: string;
}

export async function syncTransactionsForBank(
  bank: typeof bankConnections.$inferSelect
): Promise<{ synced: number; skipped: number }> {
  const rawTransactions = await fetchTransactions(bank);

  const filtered = rawTransactions.filter((trx): trx is TellerTransaction & { status: 'posted' } => {
    if (trx.status !== 'posted') return false;
    if (bank.syncFromDate && new Date(trx.date) <= bank.syncFromDate) return false;
    return true;
  });

  let synced = 0, skipped = 0;

  for (const trx of filtered) {
    const existing = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.plaidId, trx.id))
      .limit(1);

    if (existing[0]?.reviewed) {
      skipped++;
      continue;
    }

    await db
      .insert(financialTransactions)
      .values({
        plaidId: trx.id,
        transactedAt: new Date(trx.date),
        plaidName: trx.description,
        amount: parseFloat(trx.amount),
        source: bank.name,
      })
      .onConflictDoUpdate({
        target: financialTransactions.plaidId,
        set: {
          transactedAt: new Date(trx.date),
          plaidName: trx.description,
          amount: parseFloat(trx.amount),
        },
      });

    synced++;
  }

  return { synced, skipped };
}
```

### What You Gain

| Aspect | Rails | TypeScript |
|--------|-------|------------|
| **Know param types?** | No (check at runtime) | Yes (Zod validates + infers) |
| **Know return type?** | No (hope for the best) | Yes (explicit Promise<T>) |
| **Refactor safely?** | No (grep + pray) | Yes (tsc catches breaks) |
| **IDE autocomplete?** | Partial | Full |
| **AI understands it?** | Somewhat | Very well |

---

## Deployment Options

### Option 1: Keep Docker on EC2 (Recommended)

**Zero change to your deployment model.** Your current script works identically:

```bash
#!/bin/bash
# deploy.sh - works for both Rails and Node.js!

ssh $SERVER << 'EOF'
  cd /app/jarvis
  git pull
  docker-compose down
  docker-compose build
  docker-compose up -d
EOF
```

**Dockerfile (TypeScript)**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**docker-compose.yml**
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  worker:
    build: .
    command: node dist/worker.js
    environment:
      - DATABASE_URL=postgres://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=...

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### Option 2: Railway (Simplest PaaS)

> "Connect GitHub → click 'Deploy' → done. Zero Dockerfiles, zero YAML hell."
>
> — [Deploy Node.js Apps Like a Boss](https://dev.to/alex_aslam/deploy-nodejs-apps-like-a-boss-railway-vs-render-vs-heroku-zero-server-stress-5p3)

| Feature | Railway |
|---------|---------|
| **Pricing** | Pay-per-use (~$5-20/mo for Jarvis) |
| **Deploy** | Git push → auto-deploy |
| **Database** | Built-in Postgres, Redis |
| **Scaling** | Automatic |
| **Monitoring** | Built-in logs, metrics |

```bash
# One-time setup
npm install -g @railway/cli
railway login
railway init

# Deploy
railway up
```

### Option 3: Fly.io (Global Edge)

Best for: Apps that need to be fast everywhere (not really needed for personal use).

### Option 4: Keep EC2, Use PM2 (No Docker)

If you want to drop Docker entirely:

```bash
# Install
npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'jarvis-api',
      script: 'dist/index.js',
      instances: 'max',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://...',
      },
    },
    {
      name: 'jarvis-worker',
      script: 'dist/worker.js',
      instances: 2,
    },
  ],
};

# Deploy
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Deployment Comparison

| Approach | Effort | Cost | Flexibility |
|----------|--------|------|-------------|
| **Docker on EC2** (current) | Low | ~$5-10/mo | High |
| **Railway** | Very Low | ~$5-20/mo | Medium |
| **PM2 on EC2** | Low | ~$5-10/mo | High |
| **Fly.io** | Medium | ~$5-15/mo | High |

**Recommendation:** Stick with Docker on EC2. It works, you know it, and TypeScript changes nothing about the deployment model.

---

## Migration Path

### Phase 1: Scaffold (Day 1)

```bash
mkdir jarvis-api-ts && cd jarvis-api-ts
npm init -y
npm install fastify @fastify/cors @fastify/env drizzle-orm postgres bullmq zod
npm install -D typescript @types/node drizzle-kit tsx
npx tsc --init
```

### Phase 2: Database Schema (Day 1)

```typescript
// src/db/schema.ts
import { pgTable, serial, varchar, boolean, date, timestamp, numeric, text, jsonb } from 'drizzle-orm/pg-core';

export const bankConnections = pgTable('bank_connections', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull().default('plaid'),
  accountId: varchar('account_id', { length: 255 }),
  syncFromDate: date('sync_from_date'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const financialTransactions = pgTable('financial_transactions', {
  id: serial('id').primaryKey(),
  plaidId: varchar('plaid_id', { length: 255 }),
  plaidName: text('plaid_name'),
  merchantName: varchar('merchant_name', { length: 255 }),
  category: varchar('category', { length: 255 }),
  source: varchar('source', { length: 255 }),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  transactedAt: date('transacted_at'),
  hidden: boolean('hidden').default(false),
  reviewed: boolean('reviewed').default(false),
  amortizedMonths: text('amortized_months').array(),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Phase 3: Core Routes (Day 1-2)

Port in order of importance:
1. `GET /financial_transactions` (most used)
2. `PUT /financial_transactions/:id`
3. `POST /financial_transactions`
4. `GET/POST/PUT /budgets`
5. `GET /teller/accounts`

### Phase 4: Background Jobs (Day 2)

```typescript
// src/jobs/syncTransactions.ts
import { Queue, Worker } from 'bullmq';
import { db } from '../db';
import { bankConnections } from '../db/schema';
import { eq } from 'drizzle-orm';
import { syncTransactionsForBank } from '../services/teller';

const connection = { host: 'localhost', port: 6379 };

export const syncQueue = new Queue('sync-transactions', { connection });

// Schedule recurring sync
await syncQueue.add('sync-all', {}, {
  repeat: { pattern: '0 */3 * * *' }, // Every 3 hours
});

// Worker
new Worker('sync-transactions', async (job) => {
  const banks = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.isActive, true));

  for (const bank of banks) {
    if (bank.provider === 'teller') {
      const result = await syncTransactionsForBank(bank);
      console.log(`[Teller] ${bank.name}: synced ${result.synced}, skipped ${result.skipped}`);
    }
  }
}, { connection });
```

### Phase 5: Teller mTLS (Day 2)

```typescript
// src/services/teller.ts
import { Agent } from 'undici';
import fs from 'fs';

const tellerAgent = new Agent({
  connect: {
    cert: fs.readFileSync('./certs/certificate.pem'),
    key: fs.readFileSync('./certs/private_key.pem'),
  },
});

async function fetchTransactions(bank: BankConnection): Promise<TellerTransaction[]> {
  const response = await fetch(`https://api.teller.io/accounts/${bank.accountId}/transactions`, {
    headers: {
      Authorization: `Basic ${Buffer.from(bank.token + ':').toString('base64')}`,
    },
    // @ts-expect-error undici dispatcher
    dispatcher: tellerAgent,
  });

  if (!response.ok) {
    throw new Error(`Teller API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}
```

### Phase 6: Switch Over (Day 2)

1. Deploy new TypeScript app alongside Rails
2. Point frontend to new API
3. Verify everything works
4. Shut down Rails containers

---

## Risks & Considerations

### Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Breaking existing frontend** | Low | Same API contract |
| **Losing data** | Very Low | Same database, no migration |
| **mTLS issues** | Medium | Test thoroughly before switch |
| **Learning curve** | Low | You already know TypeScript |
| **Wasted effort** | Low | Small codebase, 1-2 days max |

### What You Lose

1. **Rails console** — No more `rails c` for quick queries
   - Mitigation: Use `tsx` REPL or add a `/admin` route

2. **ActiveRecord magic** — `has_many`, `belongs_to`, callbacks
   - Reality: You're barely using these anyway

3. **Resque web UI** — Job monitoring
   - Replacement: Bull Board (same functionality)

### What You Gain

1. **Single language stack** — Frontend + Backend both TypeScript
2. **Better AI assistance** — Claude generates better TypeScript
3. **Faster feedback** — Type errors caught instantly
4. **Modern tooling** — Better IDE support, debugging
5. **Smaller attack surface** — No Rails CVEs to worry about
6. **Easier hiring** (if ever needed) — More TypeScript devs than Ruby devs

---

## Recommendation

### Do the rewrite if:

- [x] You want better AI-assisted development (you do)
- [x] The codebase is small (~500 lines) (it is)
- [x] You're already comfortable with TypeScript (you are)
- [x] You're planning major new features (FUTURE_VISION.md)
- [x] You have security vulnerabilities to fix anyway (you do)

### Don't rewrite if:

- [ ] The app is critical and can't have downtime (it's not)
- [ ] You're happy with the current development experience (you're not)
- [ ] The codebase is large and complex (it isn't)

### My Recommendation

**Do it.** But do it in a weekend sprint, not a gradual migration.

1. **Friday evening:** Scaffold project, copy schema
2. **Saturday:** Port all routes, test against existing DB
3. **Sunday:** Port background jobs, do final testing
4. **Monday:** Deploy, switch frontend, celebrate

The TypeScript version will be:
- **Easier for Claude to modify** (better training data, instant type feedback)
- **Easier for you to maintain** (one language, better tooling)
- **More secure** (no Rails 5.2 EOL concerns)
- **Ready for FUTURE_VISION.md features** (same stack as Cerebro)

---

## Sources

- [Fastify Official Documentation](https://fastify.dev/)
- [Fastify in 2025: Driving High-Performance Web APIs Forward](https://redskydigital.com/gb/fastify-in-2025-driving-high-performance-web-apis-forward/)
- [Express vs Fastify Comparison](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/)
- [BullMQ Official Documentation](https://bullmq.io/)
- [BullMQ Ultimate Guide 2025](https://www.dragonflydb.io/guides/bullmq)
- [Drizzle vs Prisma: The Better TypeScript ORM in 2025](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Best ORM for NestJS in 2025](https://dev.to/sasithwarnakafonseka/best-orm-for-nestjs-in-2025-drizzle-orm-vs-typeorm-vs-prisma-229c)
- [Why I Choose TypeScript for LLM-Based Coding](https://medium.com/@tl_99311/why-i-choose-typescript-for-llm-based-coding-19cbb19f3fa2)
- [TypeScript & LLMs: Lessons Learned from 9 Months in Production](https://johnchildseddy.medium.com/typescript-llms-lessons-learned-from-9-months-in-production-4910485e3272)
- [Railway vs Fly.io vs Render Comparison](https://www.jasonsy.dev/blog/comparing-deployment-platforms-2025)
- [Deploy Node.js Apps: Railway vs Render vs Heroku](https://dev.to/alex_aslam/deploy-nodejs-apps-like-a-boss-railway-vs-render-vs-heroku-zero-server-stress-5p3)
- [Node.js in 2025: Modern Practices](https://medium.com/@chirag.dave/node-js-in-2025-modern-practices-you-should-be-using-65f202c6651d)
- [PM2 and Docker in the World of NodeJS](https://dev.to/mandraketech/pm2-and-docker-in-the-world-of-nodejs-1lg8)
