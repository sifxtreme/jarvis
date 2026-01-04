# Slack Setup (Calendar Event Extraction)
Date: 2026-01-02

This config wires Slack to extract calendar events and create them in Google Calendar.

## Slack App Setup

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
   - Subscribe to Bot Events:
     - app_mention
     - message.im
4. Install the app to your workspace.
5. Reinstall the app after adding new scopes.
6. Copy secrets:
   - `SLACK_BOT_TOKEN` (starts with `xoxb-`)
   - `SLACK_SIGNING_SECRET`

## Environment Variables

Add these to `jarvis.env` (or `.env`) using `jarvis.env.template`:

```
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
GEMINI_API_KEY=...
GEMINI_EXTRACT_MODEL=gemini-3-flash-preview
GEMINI_INTENT_MODEL=gemini-2.0-flash
```

## Run App Setup

```bash
cd backend
bundle install
docker-compose run api rake db:migrate
```

Slack events are handled by `SlackEventsController`, which inherits from
`WebhookController` so webhooks rely on Slack signatures (not the auth header).

Gemini is used to extract event details from both text and images, and events
are created on the user's primary Google Calendar.

Then restart your backend services and test by DMing or @mentioning the Slack bot.
