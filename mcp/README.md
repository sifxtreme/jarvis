# Jarvis MCP server

Local **stdio** MCP server that exposes Jarvis **finance** as read-only, masked tools for
Claude Code (one instance per person). Grocery + per-user scoping are deferred — coming back
next session. See [`../docs/DIRECTION.md`](../docs/DIRECTION.md).

## Tools

| Tool | What it does |
|---|---|
| `finance_list_transactions` | a month's transactions (masked); optional category filter |
| `finance_spending_summary` | month total + per-category breakdown |
| `finance_search` | find transactions by merchant/category text (task-shaped, not SQL) |

All output is **masked**: only `{id, date, merchant, amount, category}` leave to the model —
never `raw_data`, `external_id`, or account internals. No writes, no raw SQL/search.

## Setup (in Claude Code)

```bash
cd jarvis/mcp && npm install
```

**Get your token:** sign in at https://finances.sifxtre.me with Google, then **Settings → Copy
API token**. That's `JARVIS_TOKEN` — the same Google-issued JWT the web app uses (per-user,
~30 days, revocable). No shared key, no Google Console.

```bash
claude mcp add jarvis --scope user \
  --env JARVIS_TOKEN=<your copied token> \
  -- node /ABSOLUTE/PATH/TO/jarvis/mcp/server.mjs
```

Or a project `.mcp.json`:

```json
{
  "mcpServers": {
    "jarvis": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/jarvis/mcp/server.mjs"],
      "env": { "JARVIS_TOKEN": "..." }
    }
  }
}
```

`JARVIS_TOKEN` is required (the server fails fast without it). When it expires (~30 days), copy
a fresh one the same way. `JARVIS_API_URL` defaults to `https://sifxtre.me/api`.

## Verify

```bash
JARVIS_TOKEN=<token> node test.mjs   # spawns the server, checks tools + masking + a live read
```

## Deferred (next session)

- **Grocery tools** + **per-user scoping** (`JARVIS_MCP_SCOPE`) — the grocery-scoped Hafsa setup.
- **Calendar tools** (read/create/update).
- Writes generally stay in the web UI for now — extend deliberately.
