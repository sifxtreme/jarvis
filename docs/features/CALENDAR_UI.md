# Calendar UI
Date: 2026-01-02

## Short Spec
- Calendar page with day/week/2-week/month views and a grid layout.
- Shows multiple users together; shared events deduped.
- Toggles for work calendars with per-calendar color palette.
- “Now” line updates every minute; sunrise/dawn/sunset lines shown when location is enabled.

## Setup
- API: GET /calendar/overview?view=week&date=YYYY-MM-DD
- Frontend route: /calendar

## Decisions
- Grid layout is the primary UI (day/week/2-week/month).
- Work calendars rendered as “Busy” blocks only.
- Default view is week.

## Next Steps
- Add grid layout option.
- Add event detail drawer.
