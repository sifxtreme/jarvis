# Jarvis MCP server

Local **stdio** MCP server that exposes Jarvis finance + grocery as **scoped tools** for
Claude Code. One instance per person; scope decides which tools appear.

- **`grocery`** (default, least-privilege) — Hafsa. Grocery read + append-only item notes.
- **`full`** — Asif. Finance read (masked) + all grocery tools.

Scope is enforced by **which tools the server registers**, not by trusting the model. See
[`../docs/DIRECTION.md`](../docs/DIRECTION.md) for the why.

## Tools

| Tool | Scope | What it does |
|---|---|---|
| `grocery_spend_by_store` | both | grocery spend grouped by store, last N months |
| `grocery_list` | both | recent grocery purchases (+ any item notes) |
| `grocery_candidates` | both | grocery purchases with **no** item notes yet (the worklist) |
| `grocery_budget_status` | both | this month's grocery spend vs budget |
| `grocery_annotate` | both | **append** items to a purchase; refuses non-grocery rows; never changes the amount |
| `finance_list_transactions` | full | a month's transactions (masked) |
| `finance_spending_summary` | full | month total + per-category breakdown |
| `finance_search` | full | find transactions by merchant/category text (task-shaped, not SQL) |

All finance output is **masked**: only `{id, date, merchant, amount, category}` leave to the
model — never `raw_data`, `plaid_id`, or account internals.

## Setup (per person, in Claude Code)

Install deps once:

```bash
cd jarvis/mcp && npm install
```

Then add it to Claude Code. **Asif** (full scope):

```bash
claude mcp add jarvis --scope user \
  --env JARVIS_MCP_SCOPE=full \
  --env JARVIS_API_KEY=<the rotated key> \
  -- node /ABSOLUTE/PATH/TO/jarvis/mcp/server.mjs
```

**Hafsa** (grocery scope — the default, but set it explicitly):

```bash
claude mcp add jarvis --scope user \
  --env JARVIS_MCP_SCOPE=grocery \
  --env JARVIS_API_KEY=<the rotated key> \
  -- node /ABSOLUTE/PATH/TO/jarvis/mcp/server.mjs
```

Or a project `.mcp.json`:

```json
{
  "mcpServers": {
    "jarvis": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/jarvis/mcp/server.mjs"],
      "env": { "JARVIS_MCP_SCOPE": "grocery", "JARVIS_API_KEY": "..." }
    }
  }
}
```

`JARVIS_API_KEY` falls back to the legacy key until the rotation (task #8) lands; after that
the env var is required. `JARVIS_API_URL` defaults to `https://sifxtre.me/api`.

## Verify

```bash
node test.mjs   # spawns the server both ways, checks scope gating + a live read + the annotate guard
```

## Notes / not-yet

- Calendar tools (read/create/update) come after the calendar kernel is carved out (task #6).
- Writes are limited to `grocery_annotate` (append-only). No money-moving, no deletes, no
  canonical mutation — those stay in the web UI. Extend deliberately.
