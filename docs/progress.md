# Progress Log — 2026-01-02

## Calendar UI
- Built week/day grid layout with sticky header + time gutter.
- Added all-day lane (top of grid) and mobile agenda list.
- Added sunrise/dawn/sunset lines with hover labels.
- Implemented dynamic time window (default 6am–8pm; expands if needed).
- Added user/work filters with popover UI and per-user color palette.
- Fixed grid column alignment and busy-only filtering.
- Set week to start on Sunday.
- Added calendar chat panel (text-only) with iMessage-style flow + refresh on event creation.
- Added keyboard shortcuts (D/W/M) and day header click to jump to day view.
- Added calendar event deletion via popover (deletes in Google, marks cancelled locally).
- Added shared-event delete (one click removes both calendars) and chat panel toggle.

## Calendar Sync
- Fixed duplicate event inserts when calendars are shared across users.
- Busy blocks pulled via FreeBusy API; shown in UI with reduced opacity.
- Calendar sync now marks cancelled events instead of deleting.

## Auth
- Added session verification endpoint and switched frontend auth checks to it.
- Calendar endpoints now accept session auth (not bearer-only).

## Docs
- Added calendar future features doc (bulk actions + chat panel).
- Added layout standards doc and linked docs in README.
