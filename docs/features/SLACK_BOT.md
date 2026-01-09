# Slack Bot (Jarvis Chat)
Date: 2026-01-02

## Short Spec
- Slack bot accepts text and image messages and extracts calendar events.
- Auto-creates events on the sender’s personal Google calendar.
- Adds spouse as attendee with modify permissions.
- Logs message + AI usage for debugging and cost tracking.

## Setup

### Slack App Setup
1. Create a Slack app: https://api.slack.com/apps
2. OAuth & Permissions:
   - Bot Token Scopes:
     - app_mentions:read
     - chat:write
     - files:read
     - im:history
     - users:read.email
3. Event Subscriptions:
   - Enable events
   - Request URL: `https://<your-domain>/slack/events`
   - Bot events: app_mention, message.im
4. Install (or reinstall) the app to your workspace after adding scopes.

### Environment Variables
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_EXTRACT_MODEL=gemini-3-flash-preview`
- `GEMINI_INTENT_MODEL=gemini-2.0-flash`

### Run App Setup
```bash
cd backend
bundle install
docker-compose run api rake db:migrate
```

## Decisions
- Slack is one chat interface; web chat is also supported.
- Slack user resolution uses Slack member ID (stored on User), with email fallback.
- Image files are downloaded via Slack API and passed to Gemini.

## Next Steps
- Add Slack commands for calendar queries (availability, upcoming).
- Add Slack responses for calendar connect status.
