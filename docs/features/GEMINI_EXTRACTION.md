# Gemini Extraction
Date: 2026-01-02

## Short Spec
- Two-step LLM flow: intent classification (cheap) + extraction (accurate).
- Supports text paste and screenshot extraction.
- Anchors dates to “Today is YYYY-MM-DD” and adjusts to nearest future date.
- Logs token usage + cost per request.

## Setup
- Env:
  - GEMINI_API_KEY
  - GEMINI_EXTRACT_MODEL=gemini-3-flash-preview
  - GEMINI_INTENT_MODEL=gemini-2.0-flash
  - SLACK_BOT_TOKEN (if using Slack)
  - SLACK_SIGNING_SECRET (if using Slack)

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

## Decisions
- Two-step intent + extraction to avoid command-based UX.
- Preview model for extraction; cheaper model for intent.
- Store usage metadata and estimated costs in ai_requests.

## Next Steps
- Add more robust correction loop if needed.
- Add confidence thresholds for auto-create.
