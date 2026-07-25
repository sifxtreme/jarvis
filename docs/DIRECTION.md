# Jarvis — Direction & Decision Record

**Last updated:** 2026-07-25 · **Owner:** Asif · **Status:** living north-star doc

This is the "why" behind the current cleanup. Read it before making structural changes.
Decisions here were made by Asif on 2026-07-25 and pressure-tested against a Codex
architecture review (see `docs/codex-review-2026-07-25` notes below).

---

## North star

Jarvis becomes a **clean, shared family-ops repo** for Asif + Hafsa. The repo is the
**engineering hub** (maintainability + provenance). The **household product is the MCP
surface**, not the repo or the web UI.

- **Both Asif and Hafsa use Claude Code.** So Jarvis exposes its capabilities as **MCP
  tools** each person adds to their own Claude Code. No one needs to navigate the repo —
  their Claude navigates a small, obvious tool catalog.
- The finance core is the crown jewel (6 years of heavy daily use). Keep + invest.
- Everything else is judged by: *does a real family journey need it?*

---

## What we KEEP vs CUT

### Keep + invest
- **Finance**: bank sync (Plaid / CSV), categorization, budgets, trends. The whole point.
- **`tools/`**: the consolidated finance CLIs (SDK, importers, `grocery.mjs`, analysis).

### Keep the KERNEL, freeze the product — Calendar
Calendar is largely superseded by cloud tools, BUT its primitives will back a future
calendar MCP (add/view family events). So keep a small kernel; do not invest further.

**Keep** (the pieces three journeys need — "what's on our calendar?", "add a family
event", "show me what Claude created so I can fix it"):
- Google account/calendar connection + sync
- Canonical event model + provider IDs
- read / create / update primitives; TZ, recurrence, dedup, idempotency
- a **minimal** view/edit UI — as the *control panel to review/correct agent-created events*
- actor/source attribution (`created_by`, `created_via`), sync status/error visibility

**Freeze** the UI: correctness / security / compat fixes only. If neither person uses it
to review events after MCP launches, retire the grid later (service layer stays).
First carve a narrow `CalendarService` boundary with tests around sync + CRUD, *then* cut.

### Cut entirely
- **Web chat panel** (in-app Gemini chat that created events/txns) — "not a useful way to
  operate." Slack + MCP replace it. (task #5)
- **Memory feature** (write-only, no read UI) — superseded by the real memory system. (task #5)
- **Work-calendar features**: busy-block sync, weekly Slack "work report", morning weather
  digest, work classifications — replaced by cloud tools. (task #6)
- **Dead scaffolding**: `TestJobX` + `Dummy` model — done (commit `045103b`).
- **`mobile-app/`** — done (commit `3c693b8`).

---

## The MCP model (how the household actually uses Jarvis)

**Deploy: local stdio, one MCP server instance per person's Claude Code.** No public/hosted
endpoint, no OAuth browser flow — both users are on trusted Claude Code installs, which
collapses the threat model. (A hosted remote MCP with full OAuth would only be warranted if
a non-technical user needed phone/browser access — not our case.)

**Per-user scope by which tools the server exposes:**

| Capability | Asif | Hafsa |
|---|---|---|
| Finance summaries / budgets | Read | Grocery subset |
| Transactions | Read | Grocery subset |
| Transaction annotation | Yes | **Append-only** grocery notes/tags/proposed category |
| Canonical txn mutation (amount/owner/account) | via UI | **No** |
| Bank connections / sync controls | Admin | No |
| Calendar | Read / create / update | Read / create |
| Raw SQL / export-all / generic search | **Never via MCP** | **Never** |

**Principles that hold even for a local server** (from the Codex review — keep these):
- **Task-shaped tools only.** No generic SQL, shell, filesystem, URL-fetch, or arbitrary
  mutation. Hafsa's tools: `list_grocery_transactions`, `list_grocery_candidates`,
  `annotate_grocery_transaction`, `get_grocery_budget_status`.
- **"Grocery" is server-defined** (category/merchant rules), never "the model thinks it's
  grocery-like."
- **Annotate = append** a note/tag/proposed category. Never overwrite amount, ownership,
  account linkage, or canonical imported data.
- **Mask on output**: account numbers masked, bank-connection metadata omitted, fields
  minimized. Finance results go to the model provider and land in chat history — both users
  accept that boundary knowingly.
- Thin adapter: the MCP server does protocol + validation + shaping; it calls the Rails
  API/services with the rotated key — it does **not** query Postgres or duplicate logic.

---

## Security posture

- ✅ **God-key rotated** 2026-07-25. `ENTAROTASSADAR` was world-readable in this public repo and
  still live — rotated `JARVIS_RAILS_PASSWORD` on the box (old key → 401), removed every
  hardcoded literal. (tasks #8, #10)
- ✅ **Auth is now Google, not a shared key.** The repo is public, so **no static key.** The MCP +
  CLIs authenticate with the **same Google-issued JWT the web app uses** — sent as `Bearer`,
  from env `JARVIS_TOKEN`. Get it at finances.sifxtre.me → **Settings → Copy API token** (Google
  login, per-user, ~30-day, revocable via `JwtSession`). No Google Console changes. The static
  `JARVIS_RAILS_PASSWORD` path remains only as server-side break-glass. Verified end-to-end
  (valid Bearer JWT → 200, bogus → 401). (task #21)
- ✅ **Stopped logging the `Authorization` header** (`application_controller.rb`). (task #9)
- Keep Jarvis JWTs separate from Google / Plaid / Teller credentials.
- **Test the backup/restore** of Postgres + credentials — untested backups are the real
  single-box risk (a t3.small is otherwise fine; no Kubernetes for two people).

---

## Repo structure (conventions that matter more than folder names)

Preserve the existing Rails layout; add clear top-level boundaries:

```
backend/   Rails — canonical business logic + data access
web/        React SPA (currently finance-tracker-app/)
tools/      consolidated family CLIs (finance now; calendar/admin later)
mcp/        thin MCP adapter (to be built)
docs/       this file, PERMISSIONS, DATA_BOUNDARIES, MCP_TOOLS (generated), ONBOARDING
```

- Rails stays the source of truth. MCP + CLIs call shared services / the API — never raw SQL.
- Consolidate a CLI only when it's a **repeated family workflow** — `tools/` is not a dumping
  ground for old personal scripts.
- Hafsa's onboarding lives in a **separate** `grocery/CLAUDE.md` + checklist (task #12); she
  drives her Claude via the MCP tool catalog, not the repo.

---

## Phased implementation order (ruthless)

1. Rotate creds + stop header logging; rip out chat + memory. (#5, #8, #9, #10)
2. Trim calendar to its kernel; carve `CalendarService` with tests. (#6)
3. Build the local MCP: **Asif, finance read-only + calendar read-only first**. (#11)
4. Add Hafsa's grocery-scoped MCP + her CLAUDE.md/checklist. (#12)
5. Idempotent calendar create; annotation writes; defer deletion/mutation.
6. Consolidate remaining personal CLIs incrementally.

**Success = Hafsa can ask her Claude about groceries or add a family event safely, while a
stolen token / confused model / malformed request has a deliberately small blast radius.**
Not "Jarvis has an MCP server."
