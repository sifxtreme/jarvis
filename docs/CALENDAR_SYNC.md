# Calendar Sync (Busy-Only)

## Goals

- Create events on each user’s personal calendar.
- Show **busy blocks only** for work calendars (no titles/locations/details).
- Sync busy blocks every 10 minutes for the next 30 days.

## Recommended Setup

1. Share each work calendar into the user’s **personal** Google account with
   “See only free/busy”.
2. Connect the personal account via the app’s Calendar OAuth flow.
3. Mark the work calendar as `busy_only` in `calendar_connections`.

Example (Rails console):
```ruby
connection = CalendarConnection.find_by(calendar_id: "work_calendar_id")
connection.update!(busy_only: true)
```

## API Behavior

- Event creation uses the user’s **primary** calendar.
- Attendees include the spouse, with `guestsCanModify: true`.
- Work calendar sync uses the **FreeBusy API** and stores only `{start_at, end_at}`.

## Sync Window

- 30 days into the future, refreshed every 10 minutes.
