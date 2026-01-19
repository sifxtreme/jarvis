# Gemini Extraction & AI Capabilities
Date: 2026-01-10

## Overview
Jarvis uses a **Router Pattern** powered by Google Gemini models to handle natural language understanding. It employs a two-step flow:
1.  **Context-Aware Intent Classification:** Determines what the user wants (Calendar, Finance, Memory, etc.) using recent conversation history.
2.  **Specialized Extraction:** Extracts structured data (JSON) based on the intent.

## Models
- **Intent & Reasoning:** `gemini-2.0-flash` (Fast, cheap, good at classification)
- **Extraction:** `gemini-3-flash-preview` (Higher precision for extracting details from text/images)

## Capabilities

### 1. Intent Classification
- **Input:** User text + Last 10 messages (Context) + Image (optional)
- **Output:** JSON with `intent` (create_event, update_event, create_transaction, etc.) and `confidence`.
- **Context Awareness:** Can resolve "Yes" or "That one" by looking at previous messages.

### 2. Calendar Management
- **Create Event:** Extracts title, date, time, location, recurrence rules.
- **Update Event:** Understands "Move gym to 6pm" (Requires context to know *which* event).
- **Delete Event:** Understands "Cancel my 2pm meeting".
- **List Events:** Filters by date range and optional title keywords.
- **Recurring Support:** specific prompts to distinguishing between "this instance" and "whole series".

### 3. Finance Tracking
- **Create Transaction:** Extracts merchant, amount, date, category, and source.
- **Receipt Parsing:** Can extract transaction details from uploaded images.
- **Correction:** Supports "Actually that was $50" via correction prompts.

### 4. Memory (The "Butler's Notebook")
- **Create Memory:** "Remember that the gate code is 1234".
- **Search Memory:** "What is the gate code?" -> Semantic + Keyword search.
- **Extraction:** Normalizes content and categorizes it (Fact, Preference, Task).

## Prompts & Engineering
- **Context Block:** All major prompts now inject a `Recent conversation context:` block to maintain state.
- **Time Anchoring:** All prompts are injected with `Today is YYYY-MM-DD (Timezone: America/Los_Angeles)` to resolve relative dates like "next Friday".
- **JSON Mode:** We enforce strict JSON output for reliability.

## Testing Plan

1. **Context Retention**
   - User: "Book a meeting with Bob." -> Bot: "When?" -> User: "Tomorrow at 2pm."
   - Verify: Bot creates event for Tomorrow 2pm (Context successfully bridged the gap).

2. **Image Extraction**
   - Upload flyer -> Verify correct Date/Time/Title extraction.

3. **Ambiguity Handling**
   - User: "Going" (with no context) -> Bot should ask for clarification, not crash.
   - User: "Going" (after "What's the title?") -> Bot uses "Going" as title.

## Future Improvements
- **Function Calling:** Move from manual "Intent -> Extract" code to Native Gemini Function Calling for simpler code.
- **RAG:** Implement `pgvector` to inject long-term memories into the Context Block.