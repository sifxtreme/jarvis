# Slack Setup (Stub Replies Only)

This config gets Slack wired up with simple test responses.

## Slack App Setup

1. Create a Slack app: https://api.slack.com/apps
2. OAuth & Permissions:
   - Bot Token Scopes:
     - app_mentions:read
     - chat:write
     - files:read
     - im:history
3. Event Subscriptions:
   - Enable events
   - Request URL: `https://<your-domain>/slack/events`
   - Subscribe to Bot Events:
     - app_mention
     - message.im
4. Install the app to your workspace.
5. Copy secrets:
   - `SLACK_BOT_TOKEN` (starts with `xoxb-`)
   - `SLACK_SIGNING_SECRET`

## Environment Variables

Add these to `jarvis.env` (or `.env`) using `jarvis.env.template`:

```
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
```

## Run App Setup

```bash
cd /Users/asifahmed/code/experiments/jarvis/backend
bundle install
docker-compose run api rake db:migrate
```

Then restart your backend services and test by DMing or @mentioning the Slack bot.
