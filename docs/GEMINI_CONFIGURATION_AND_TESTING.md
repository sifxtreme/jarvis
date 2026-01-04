# Gemini Configuration and Testing Plan
Date: 2026-01-02

## Configuration Plan

1. **Gemini API key**
   - Create a key at https://ai.google.dev/
   - Set `GEMINI_API_KEY` in `jarvis.env`

2. **Models**
   - Extraction model: `GEMINI_EXTRACT_MODEL=gemini-3-flash-preview`
   - Intent model (cheaper): `GEMINI_INTENT_MODEL=gemini-2.0-flash`

3. **Slack credentials**
   - Ensure `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` are set in `jarvis.env`

4. **Migrations**
   - Run: `docker-compose run api rake db:migrate`
   - New tables: `chat_messages`, `ai_requests`

5. **Deploy/restart**
   - Rebuild image: `docker-compose build api`
   - Restart services: `docker-compose up -d`

## Testing Plan

1. **Slack text extraction**
   - Send a message with date/time/location/details in Slack
   - Verify the response includes structured fields
   - Check `chat_messages` row created with `has_image = false`
   - Check `ai_requests` row created with token counts + cost

2. **Slack image extraction**
   - Send a screenshot that includes event details
   - Verify the response includes structured fields
   - Check `chat_messages` row created with `has_image = true`
   - Check `ai_requests` row created with token counts + cost

3. **No-event handling**
   - Send a random message/image without event info
   - Verify the response says no event found
   - Confirm `ai_requests.status = error` with usage metadata captured (if provided)

4. **Slack verification**
   - Event Subscriptions should show “verified”
   - URL: `https://<your-domain>/slack/events`
