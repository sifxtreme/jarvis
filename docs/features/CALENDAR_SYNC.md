# Calendar Sync
Date: 2026-01-02

## Short Spec
- Personal calendars: full event sync for next 30 days.
- Work calendars: busy-only sync for next 30 days.
- Sync runs every 10 minutes.

## Goals
- Sync Google Calendar data into the app for a 30-day window.
- Personal calendars: full event details.
- Work calendars: **busy blocks only** (no titles/locations/details).
- Sync runs every 10 minutes.

## Setup
- Enable Google Calendar API in Google Cloud project.
- Connect each personal account via OAuth (Connect Calendar button).
- Share each work calendar into personal account with “See only free/busy”.
- Mark work calendars as busy-only in calendar_connections.

## Decisions
- Use FreeBusy API for work calendars to avoid storing sensitive data.
- Store personal event details for UI and future search.
- 30-day window to keep data small and relevant.

## API Behavior
- Sync runs via `SyncCalendarEvents` (scheduled every 10 minutes).
- Work calendar sync uses the **FreeBusy API** and stores only `{start_at, end_at}`.
- Event creation is handled by Slack/Web chat flows, not this sync job.

## Next Steps
- Add UI toggle to mark calendars as busy-only.
- Add incremental sync tokens (if needed).
