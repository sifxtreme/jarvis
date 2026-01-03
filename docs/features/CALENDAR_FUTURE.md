# Calendar Future Features
Date: 2026-01-02

## Short Spec
- Add multi-select + bulk actions for calendar events.
- Add a slide-out chat panel on the Calendar page for natural-language event creation and edits.
- Keep Slack as an optional input path; UI should not depend on Slack.

## Setup
- None (planning doc).

## Decisions
- **Bulk actions** should work on personal calendars first; work calendars remain read-only.
- **Selection UX** should avoid accidental deletes: explicit "Select mode" with checkboxes or drag-rectangle.
- **Chat panel** should be side-by-side with the grid (like the Transactions summary panel), not a modal.
- **Chat output** should show the structured event payload (date/time/title/location) with an "Apply" action.

## Feature Details
### 1) Multi-select + bulk actions
- Add a "Select" toggle in the Calendar toolbar.
- In select mode:
  - Grid events show checkboxes.
  - Shift-click selects ranges in day/week views.
  - "Select all in view" action for day/week/month.
- Actions:
  - Delete selected events (primary).
  - Optional: Move to date/time, Change calendar.
- Confirmations:
  - One confirmation for >1 event delete.
  - Show count + date range summary.

### 2) Slide-out chat panel
- Right-side panel with:
  - Input box (NL text).
  - History list of chat interactions.
  - Draft event preview card(s).
- Panel states:
  - Collapsed (icon + badge).
  - Expanded (300–360px width).
- Flow:
  1) User enters: "Lunch with Hafsa tomorrow at 1pm".
  2) LLM returns structured event(s).
  3) User taps "Create".
  4) UI shows success + calendar refresh.

## Requirements & Dependencies
- Backend:
  - Bulk delete endpoint for calendar events (scoped by user + calendar).
  - Create/update endpoints for personal calendar events.
  - Validation that the caller owns the calendar.
- Frontend:
  - Selection state store (per-view).
  - Bulk action confirmation UI.
  - Chat panel component with persistence (optional).

## Next Steps
- Design selection UX (checkboxes vs drag-select).
- Add bulk delete endpoint + permission checks.
- Implement chat panel skeleton (no LLM call yet).
