# Calendar UI
Date: 2026-01-02

## Short Spec
- New Calendar page with day/week/2-week/month views.
- Shows both users together; shared events deduped.
- Toggles for per-user and per-user work calendars.
- “Now” red line updated every minute.

## Setup
- API: GET /calendar/overview?view=week&date=YYYY-MM-DD
- Frontend route: /calendar

## Decisions
- List/group-by-day layout first to move fast.
- Work calendars rendered as “Busy” blocks only.
- Default view is week.

## Next Steps
- Add grid layout option.
- Add event detail drawer.
