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

## Decisions
- Two-step intent + extraction to avoid command-based UX.
- Preview model for extraction; cheaper model for intent.
- Store usage metadata and estimated costs in ai_requests.

## Next Steps
- Add more robust correction loop if needed.
- Add confidence thresholds for auto-create.
