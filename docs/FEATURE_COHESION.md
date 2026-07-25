# Feature Cohesion & Gap Analysis — Jarvis

Date: 2026-04-26
Owner: Asif
Status: Strategy memo

## TL;DR

Jarvis has two strong pillars (transactions, calendar) plus three connective tissues (chat, Gemini extraction, memory). The pillars are solid in isolation but barely talk to each other — there's no unified read surface, no cross-feature views, and the memory layer is write-only with no UI. The product reads like five small apps in a trench coat. The next leverage move is **a single "today" surface** that fuses calendar + transactions + memory + alerts, plus killing or doubling down on the web chat (which currently competes with the Slack bot for the same job).

---

## What's currently shipped (per README + code)

| Surface | Inputs | Outputs | Notes |
|---|---|---|---|
| Transactions | Teller sync (3hr cron), quick-add, Gemini txn extract | Table, search, filters, hide/review | Core daily-use surface |
| Trends | derived | MoM by category/merchant, charts | Read-only, transactions-only |
| Yearly Budget | derived | annual budget table | Read-only |
| Calendar UI | Google sync, chat-create | day/week/2wk/month grid | Live |
| Calendar Chat (web) | text only | event create | No image upload (Slack has it) |
| Slack Bot | screenshot + text | event create, transaction create | Best mobile surface today |
| Gemini Extraction | shared | structured records + intent classification | Powers chat + slack bot |
| Google Auth | OAuth | session | Single user |
| Teller Repair | UI tool | re-auth bank tokens | Admin-y, narrow |
| Memory (intents in code, no UI) | chat | `create_memory`, `search_memory` | **Write-only — no browse page** |
| Digest (intent in code) | scheduled? | summary | **Unclear if surfaced anywhere** |

---

## What's coherent (the spine works)

1. **Chat → Gemini → typed record** is the same pattern across calendar events, transactions, and memories. That uniformity is hard-won and elegant. Don't break it.
2. **Slack as the mobile capture channel** — text + screenshot on phone — sidesteps the lack of a native app well. This is doing real work.
3. **Transactions + budget** are tightly coupled. Trends and YearlyBudget read from the same source.
4. **Calendar grid + Google sync** is one feature pretending to be two. Coherent.

## What's incoherent (where the product is doing two things badly instead of one well)

### 1. Web chat competes with Slack bot for the same job
Both surfaces let you create events from text. Web chat doesn't take images, Slack does. They live in two codepaths through the same Gemini client. **Question to answer with data**: when was the last time you used the web chat to create an event vs. Slack? If web chat is <10% of creates, kill the panel and reclaim the screen real estate. If it's >30%, ship image upload and bring the surfaces to parity.

### 2. Memory is a black box
`create_memory` and `search_memory` exist as Gemini intents. There's no `/memories` page to browse, edit, or delete. You're trusting the bot to recall — but with no surface to audit what it has, the feature can never grow trust. **Recommendation**: a 1-day spike to add a flat `/memories` list view (filter by category, edit, delete). Same DB table, no schema work, just a CRUD surface.

### 3. Trends ignores half the data
Trends shows transaction trends. The calendar has equally analyzable data — meeting load, focus blocks, weekend events, sleep windows (you have sun calc already). A "Time Trends" tab would be ~1 day of work and gives you "did I actually take more focus time this month?" without any new data ingestion.

### 4. Budget doesn't know about scheduled bills
Recurring detection ("missing recurring alert") and calendar events ("rent due 5/1") live in different worlds. A bill calendar event should pre-debit the budget projection. Today, Jarvis is reactive ("you missed your Netflix charge") instead of forward-looking ("$3,200 of bills hit before your next paycheck").

### 5. No "today" surface
Open Jarvis right now — you land on transactions. To see today you need: `/calendar` (today's events) + `/` (today's spending) + nothing for memory hits + nothing for missing-recurring. Four glances. **The single highest-leverage feature** is a `/today` page: today's calendar agenda, today's transactions, missing-recurring alerts, any memory due, and a chat box at the bottom. Becomes the new home route.

### 6. Digest intent has no delivery channel I can find
Gemini knows how to handle a `digest` intent, but I don't see a job that proactively pushes one to Slack each morning. Either kill the intent (dead branch) or wire a daily 7am Slack DM — "today: 3 events, $X spent yesterday, $Y of bills coming this week."

---

## What's missing (additions worth considering, ranked)

| # | Feature | Effort | Why it matters |
|---|---|---|---|
| 1 | `/today` unified home view | M (2-3 days) | Replaces 4 glances with 1. Becomes the everyday entry point. |
| 2 | `/memories` browse + CRUD page | S (1 day) | Unlocks an existing capability that's currently invisible. Trust grows or the feature dies — both are good outcomes. |
| 3 | Daily morning digest to Slack | S (½ day) | Wires existing `digest` intent to a Resque cron + Slack DM. Pushes Jarvis from pull → push. |
| 4 | Tag transactions to calendar events | M (2 days) | "Trip to NYC" event → see all txns tied to it. Trip costs, event ROI, kid-activity spend — many use cases unlock. |
| 5 | Bill calendar events → budget projection | M (1-2 days) | Forward-looking cashflow instead of rear-view-mirror reporting. |
| 6 | Calendar trends tab (meeting load, focus, weekend density) | S-M (1 day) | Free signal from data already in DB. |
| 7 | Universal search box (txns + events + memories) | M (2 days) | One Cmd-K across the app. Currently each surface has its own search. |
| 8 | Slack budget-threshold alerts ("80% of dining this month") | S (½ day) | Proactive, not reactive. Adds urgency before the line is crossed. |

## What's redundant (candidates to delete or consolidate)

- **Web chat panel** if Slack carries >70% of conversational creates → delete and reclaim layout space (see #1 above).
- **`mobile-app/` directory** — empty `node_modules`-only shell. Either start it (a real decision) or `rm -rf` it. Half-states rot.
- **`docs/POOR_EXPERIENCES.md`** — last entry Jan 10. Either auto-append from the chat error path or delete.

## What's risky (debt that constrains future moves)

- **Memory schema not designed for retrieval at scale** — Stevens-style "one flexible table" works at 1k rows; you'll need vector search or tags before 10k. Worth thinking about before #2 above ships and creates a year of write-only data.
- **Two extraction surfaces (web chat, Slack bot) call the same `GeminiClient` but with slightly diverged context-building**. Worth a 2-hour pass to extract a shared `ChatContextBuilder` — otherwise prompt drift is inevitable.
- **No event-source-of-truth for "what intent fired"**. If you ever want to evaluate Gemini accuracy or A/B prompt changes, you need a `gemini_calls` table logging input + classified intent + extracted payload + corrections applied. Cheap to add now, expensive to backfill.

---

## Recommended sequencing (next ~3 weeks)

| Week | Theme | Items |
|---|---|---|
| 1 | **Make Jarvis push-shaped, not pull-shaped** | Daily Slack digest (#3) + budget threshold alerts (#8). One Resque cron + two Slack message paths. |
| 2 | **Unified read surface** | `/today` page (#1) + `/memories` CRUD (#2). Both lean on existing data. |
| 3 | **Cross-pollination** | Calendar trends tab (#6) — fast win. Then start the bill-projection (#5) work which is the bigger swing. |

After these three weeks the product is meaningfully more cohesive and you can re-decide on web chat vs Slack with usage data instead of guessing.

---

## Out of scope for this memo

- The bigger Stevens-style "AI butler" vision in `FUTURE_VISION.md` — directionally agree, but household hub / grocery / chores are net-new product surfaces, not cohesion fixes. Treat them as v2.
- Native mobile app — covered in `TECH_DEBT_FRONTEND.md` and `UX_IMPROVEMENTS_2026.md` from the responsive-Safari angle. Native is its own decision (kill the empty dir or commit a quarter to Expo).
- Email triage — separate ingestion surface, deserves its own design doc.
