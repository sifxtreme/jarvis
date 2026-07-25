# Family comms — ideation & landscape (iMessage as the skin)

**Date:** 2026-07-25 · **Status:** research / ideation (NOT a committed build)

The goal: a **skinless** way for Asif + Hafsa (and their Claudes) to interact with the
household system — no new app to open. **Slack is being retired.** iMessage is where they
already live, so iMessage should be the primary human interface; the Jarvis MCP is the brain.

This doc captures what exists so we can iterate. Nothing here is decided.

---

## How iMessage automation actually works on macOS

There is **no official Apple API**. Every approach is one of:

- **Send** — AppleScript / `osascript` drives Messages.app. Free, needs "Automation" permission,
  requires a signed-in Mac that's on. (Asif has an **always-on Mac-Server** — ideal host, and
  it's existing hardware, so no new infra.)
- **Receive** — read the local **`chat.db`** SQLite (needs Full Disk Access); for real-time,
  watch the **`chat.db-wal`** write-ahead log. This is how every bridge detects new messages.
- **Managed API** — pay a service to run the Mac bridge for you (see below).

## Open-source tools that already exist

**iMessage MCP servers** (plug straight into Claude Code / Desktop — Asif's Claude can read/send
iMessage *today*):
- **[carterlasalle/mac_messages_mcp](https://github.com/carterlasalle/mac_messages_mcp)** — the most complete: queries `chat.db`, resolves contacts, attachments, group chats, send + receive.
- [daveremy/imessage-mcp](https://github.com/daveremy/imessage-mcp), [tchbw/mcp-imessage](https://github.com/tchbw/mcp-imessage), [wolfiesch/imessage-mcp](https://github.com/wolfiesch/imessage-mcp) — lighter variants.

**Agent-oriented CLIs / bridges:**
- **[micahbrich/imsg-plus](https://github.com/micahbrich/imsg-plus)** — a clean CLI for Messages.app "so your agent can send and receive," explicitly built to *replace* BlueBubbles. Good primitive if we want our own thin layer.
- **[BlueBubbles](https://gist.github.com/hmseeb/e313cd954ad893b75433f2f2db0fb704)** — full open-source Mac server + REST API + **webhooks** (real-time receive) + its own iOS/Android/web clients. Heavier, battle-tested.

**Managed (paid) APIs** — no Mac to babysit, iMessage→SMS fallback, but recurring fee + data leaves your box: **Sendblue** (REST + its own MCP server + auto SMS fallback), Loop, Blooio, **Claw Messenger** (no-Mac-bridge).

**Claude-to-Claude (from the earlier pass):** [claude-peers-mcp](https://github.com/jamditis/claude-peers-mcp), Claude Relay, Claude IPC MCP, MCP Talk, cc2cc. Standard: **A2A** (Linux Foundation) — overkill for two people.

## The pattern that matters: draft-then-approve

Industry consensus for reliability: **the agent drafts, a human taps send.** Full autopilot is
scoped only to narrow, safe intents (read-only answers, status). **Critical for us**: a finance
system must never auto-text a money action — reads can auto-reply, writes get a human confirm.

## Reference product

**[Poke](https://9to5mac.com/2026/06/04/apples-messages-app-on-iphone-now-has-a-third-party-ai-agent/)**
(Mar 2026) — first third-party AI agent officially on iMessage: proactive, replies to messages,
schedules, etc. Proof the "assistant lives in your texts" UX works. Worth studying for feel.

---

## Recommended architecture for us (to iterate on, not build yet)

```
Hafsa/Asif text (iMessage, normal thread)
        │  received via chat.db-wal watch  (on the always-on Mac-Server)
        ▼
   family-bridge  ── routes to ──►  a Claude with the Jarvis MCP (scoped tools)
        │                                   │ drafts answer / proposed action
        │  reads: auto-reply                ▼
        │  writes: draft-then-approve   osascript send  ──►  iMessage back in-thread
```

- **Skin = iMessage** (no new app). **Brain = Jarvis MCP** (finance/grocery/calendar, already
  scoped + masked). **Host = the existing always-on Mac-Server** (no new infra).
- Start read-only ("how much on groceries this month?") → auto-reply. Add writes behind
  draft-then-approve.
- This also *is* the Claude-to-Claude channel: the shared iMessage thread + shared MCP state is
  the bus; no separate messaging system to secure.

### Open questions (for later)
- Own thin bridge (`imsg-plus` / `mac_messages_mcp`) vs BlueBubbles vs a managed API?
- One assistant identity texting both, or each person's own Claude?
- Naming (per NAMING_CONVENTION): work name e.g. `family-bridge`; fun name TBD.
- Group-thread etiquette: when does the assistant speak vs stay silent?

---
*Iterate, iterate, iterate — see what actually feels good for Asif + Hafsa. Retire Slack.*
