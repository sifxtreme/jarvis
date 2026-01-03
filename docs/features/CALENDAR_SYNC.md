# Calendar Sync
Date: 2026-01-02

## Short Spec
- Personal calendars: full event sync for next 30 days.
- Work calendars: busy-only sync for next 30 days.
- Sync runs every 10 minutes.
- Slack-created events stored with full details.

## Setup
- Enable Google Calendar API in Google Cloud project.
- Connect each personal account via OAuth (Connect Calendar button).
- Share each work calendar into personal account with “See only free/busy”.
- Mark work calendars as busy-only in calendar_connections.

## Decisions
- Use FreeBusy API for work calendars to avoid storing sensitive data.
- Store personal event details for UI and future search.
- 30-day window to keep data small and relevant.

## Next Steps
- Add UI toggle to mark calendars as busy-only.
- Add incremental sync tokens (if needed).
