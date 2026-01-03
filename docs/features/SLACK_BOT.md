# Slack Bot (Jarvis Chat)
Date: 2026-01-02

## Short Spec
- Slack bot accepts text and image messages and extracts calendar events.
- Auto-creates events on the sender’s personal Google calendar.
- Adds spouse as attendee with modify permissions.
- Logs message + AI usage for debugging and cost tracking.

## Setup
- Slack app scopes:
  - app_mentions:read
  - chat:write
  - files:read
  - im:history
  - users:read.email
- Event subscriptions:
  - Request URL: https://sifxtre.me/api/slack/events
  - Bot events: app_mention, message.im
- Env:
  - SLACK_BOT_TOKEN
  - SLACK_SIGNING_SECRET

## Decisions
- Slack is the primary chat interface for now.
- Slack user resolution uses Slack member ID (stored on User).
- Image files are downloaded via Slack API and passed to Gemini.

## Next Steps
- Add Slack commands for calendar queries (availability, upcoming).
- Add Slack responses for calendar connect status.
