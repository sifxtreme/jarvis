# Hafsa's grocery workspace 🛒

Hi Hafsa! This folder is **yours**. When you open Claude Code here, Claude reads this file and
knows how to help you with our grocery spending. You don't need to touch any code — just talk
to Claude in plain English, and it will use the **grocery tools** for you.

## What you can do

Your Claude has these grocery tools (they read our real Jarvis finance data, but only the
grocery part — nothing else):

| Ask Claude something like… | It uses |
|---|---|
| "Where are we spending on groceries?" / "by store, last 3 months" | `grocery_spend_by_store` |
| "Show me our recent grocery purchases" | `grocery_list` |
| "Which purchases still need item notes?" | `grocery_candidates` |
| "How are we doing on the grocery budget this month?" | `grocery_budget_status` |
| "Add 'eggs, milk, bread' to purchase 12345" | `grocery_annotate` |

Just ask naturally — "did we go over budget on groceries?", "how much do we spend at Costco vs
Sprouts?", "add these items to that Sprouts trip." Claude figures out the tool.

## The rules (so nothing breaks)

- You can **only** see and edit **grocery** things. Everything else in our finances is off-limits
  to your tools — on purpose. You can't accidentally change a bill or a paycheck.
- Adding item notes **only adds** — it never changes the dollar amount of a purchase. Safe to
  do freely.
- If you ever want to do something the grocery tools can't (fix a wrong amount, add a whole new
  store category, pull non-grocery numbers), just **ask Asif** — that's by design, not a bug.

## Your mission

Build the best grocery-insight system you can. Some directions to explore with your Claude:

- **Item tracking** — go through `grocery_candidates` and note what we actually bought. Over
  time this turns "we spent $130 at Costco" into "we spent $130 on X, Y, Z."
- **Store strategy** — which store is cheapest for what? `grocery_spend_by_store` is the start.
- **Budget awareness** — watch `grocery_budget_status` through the month.
- **Ask for more tools** — if you keep wanting something your tools can't do, tell Asif; he can
  add a new grocery tool for you.

See [`CHECKLIST.md`](./CHECKLIST.md) for a simple weekly + monthly routine.

---
*Setup (one time): sign in at https://finances.sifxtre.me with your Google account, then
**Settings → Copy API token**. Asif adds the `jarvis` MCP to your Claude Code with that token
(grocery scope) — see `../mcp/README.md`. When the token expires (~monthly), copy a fresh one
the same way. After that, everything above just works.*
