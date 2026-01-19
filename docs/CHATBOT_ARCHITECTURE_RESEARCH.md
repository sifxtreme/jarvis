# Chatbot Architecture Research & Decisions (2025/2026)

**Date:** January 10, 2026
**Project:** Jarvis Finance/Calendar Bot
**Context:** User requested an evaluation of moving to "LangChain" or similar agentic frameworks versus the current Ruby implementation.

## 1. Executive Summary

**Decision:** **Maintain the current "Router" architecture** for now.

**Reasoning:** The current implementation is robust, predictable, and highly performant for the defined set of tasks (Calendar & Finance management). Moving to a fully autonomous "Agent" framework (like LangChain) would introduce unnecessary complexity, latency, and "hallucination" risks without adding significant value for these specific use cases.

**Future Path:** The natural evolution for this codebase is **Native Function Calling** (replacing manual intent classification with Gemini Tools), not full Agentic autonomy.

---

## 2. Architecture Landscape (2025/2026)

### A. The "Router" Pattern (Current Implementation)
*   **How it works:**
    1.  **Input:** User text ("Book gym for 6pm").
    2.  **Router (LLM):** `classify_intent` determines the goal -> `create_event`.
    3.  **Extractor (LLM):** `extract_event_data` pulls specific fields (Title: Gym, Time: 6pm) into a JSON structure.
    4.  **Executor (Code):** Hard-coded Ruby methods (`create_event`) take the JSON and update the database.
*   **Pros:**
    *   **Predictable:** You explicitly define what the bot can and cannot do.
    *   **Safe:** Database operations are handled by standard Rails active records with validations.
    *   **Debuggable:** Easy to trace exactly why a specific action was taken.
*   **Cons:**
    *   Requires manual code for every new "skill" (e.g., adding a "Weather" feature requires a new `handle_weather` method).

### B. The "Agent" Approach (LangChain / AutoGPT)
*   **How it works:**
    *   You initialize an "Agent" with a goal ("Manage my life") and a set of Tools (Calendar API, Calculator, Google Search).
    *   The Agent enters a loop: *Think -> Act -> Observe -> Repeat*.
    *   It autonomously decides which tools to call and in what order.
*   **Pros:**
    *   **Flexible:** Can handle novel, multi-step requests ("Find a gym near me, check their hours, and book a slot").
*   **Cons:**
    *   **Unpredictable:** Agents often get stuck in loops or use tools incorrectly.
    *   **Latency:** The "Think-Act-Observe" loop requires multiple round-trips to the LLM, making it slower.
    *   **Overkill:** For a task like "Add event to calendar," a reasoning loop is unnecessary overhead.
    *   **Ruby Support:** LangChain is primarily Python/JS. Ruby ports exist but are less mature.

### C. The "Function Calling" Approach (The Modern Standard)
*   **How it works:**
    *   Instead of separate "Classify" and "Extract" steps, you send the user text + a list of valid function definitions (JSON Schema) to the LLM.
    *   **User:** "Lunch with Mom tomorrow."
    *   **LLM Response:** `tool_use: create_event(title="Lunch with Mom", date="2026-01-11")`
    *   The backend executes the tool and returns the result.
*   **Pros:**
    *   **Simpler Code:** Removes the need for manual `classify_intent` logic.
    *   **Higher Accuracy:** Models like Gemini 2.0 and GPT-4 are fine-tuned specifically for this structure.
*   **Status:** This is the recommended **refactoring target** for this project in the future.

---

## 3. Deep Dive: Why We Rejected LangChain (for now)

1.  **Tech Stack Mismatch:** Your backend is Ruby on Rails. LangChain's ecosystem is heavily Python-centric. Introducing a Python microservice just for chat handling would complicate deployment and maintenance.
2.  **Context Management:** We fixed the "context loss" issue by simply passing the last 10 messages to the Router. We didn't need a complex "Vector Memory" system for this immediate improvement.
3.  **Control:** In finance and calendar applications, **safety is paramount**. We don't want an Agent "experimenting" with transaction APIs. The Router pattern ensures that only specific, validated actions are ever executed.

---

## 4. Future Roadmap

If we revisit the chatbot architecture, here is the recommended path:

1.  **Phase 1: Native Function Calling (Refactor)**
    *   Replace `GeminiClient#classify_intent` and `GeminiClient#extract_event` with a single **Gemini Function Calling** API request.
    *   Define tools: `create_event`, `delete_event`, `get_balance`.
    *   Let Gemini explicitly choose the tool and arguments in one shot.

2.  **Phase 2: RAG (Retrieval-Augmented Generation)**
    *   If you want the bot to answer questions about your *past* data ("How much did I spend on coffee last year?"), we will need RAG.
    *   This involves indexing your `FinancialTransaction` and `CalendarEvent` records into a vector database (like `pgvector` in PostgreSQL).
    *   The bot would first "search" your database, then use that data to answer the question.

---

## 5. Infrastructure Strategy (EC2 + Rails)

Since the project is hosted on **AWS EC2** (running Rails, Postgres, and Redis), we can leverage this "Power User" setup to build a robust AI backend without needing third-party vector databases (like Pinecone) or platform-as-a-service costs.

### A. The "Memory" Database (PostgreSQL + pgvector)
Instead of adding a new database service, we will upgrade the existing Postgres instance on EC2.
*   **Action:** Install the `pgvector` extension on the EC2 Postgres instance.
*   **Rails Integration:** Use the `neighbor` gem to query embeddings.
*   **Benefit:** Keeps "Memory" data (vectors) strictly relational to your Users and Transactions. Zero latency between your data and your vectors.

### B. Asynchronous "Thinking" (Redis + Resque)
AI Models (Gemini/GPT-4) are slow. A 5-second HTTP request will hang the Rails web server (Puma) if handled synchronously.
*   **Current State:** You have `Resque` configured (`config/initializers/resque.rb`).
*   **Future Pattern:**
    1.  **UI:** User sends message -> Rails Controller saves `ChatMessage(status: 'pending')`.
    2.  **Job:** Controller enqueues `AiChatJob` to Redis.
    3.  **Worker:** Resque worker picks up the job, calls Gemini API.
    4.  **Streaming:** Worker broadcasts the tokens (or final result) via **ActionCable** to the frontend.

### C. Deployment & Security (The Bottleneck)
The current **Rails 5.2** stack is a liability for building modern AI features.
*   **Security:** Rails 5.2 is EOL (End of Life) and receives no security patches.
*   **Features:** Rails 7+ introduces native `ActiveStorage` improvements (critical for handling Chat Images) and `Turbo` (critical for streaming AI text).
*   **Deployment:** The current `update_server.sh` script is fragile.
*   **Recommendation:** Adopt **Kamal** for containerized, zero-downtime deployments to the EC2 instance.

---

## 6. Migration & Modernization Roadmap

### Phase 1: Chatbot Logic (Completed)
*   [x] Fixed "Context Loss" bug by injecting history into the classifier.
*   [x] Fixed "Phantom Event" bug where the bot hallucinated titles from dates.

### Phase 2: Memory & Storage (Next Steps)
*   [ ] **Upgrade Postgres:** Ensure EC2 Postgres version supports `pgvector`.
*   [ ] **Vector Migration:** Add `embedding` columns to `memories` and `financial_transactions`.
*   [ ] **Backfill:** Run a script to generate embeddings for all past notes.

### Phase 3: The "Big Lift" (Rails 7 Upgrade)
*   [ ] **Audit:** Run `rails_upgrade_check` or `next_rails` to identify breaking changes.
*   [ ] **Upgrade:** Move from 5.2 -> 6.0 -> 6.1 -> 7.0.
*   [ ] **Frontend:** Replace legacy asset pipeline with `Propshaft` or `esbuild` (if not using the separate React app).

### Phase 4: Refactor to Function Calling
*   [ ] Remove the manual "Router" (`classify_intent`) logic.
*   [ ] Implement a unified `GeminiAgent` class that sends the user prompt + Tool Definitions (JSON) in one request.

---

## 7. Poor Experiences Log

We established `docs/POOR_EXPERIENCES.md` to track specific failures.
*   **2026-01-10 Fix:** The bot was aggressively filtering "Tomorrow" events by title (e.g., looking for events named "Going" when the user asked "What's going on?").
    *   **Fix:** Updated `handle_list_events` to ignore title filtering if only a date is provided.
*   **2026-01-10 Fix:** Context Loss.
    *   **Fix:** Updated `classify_intent` to ingest conversation history.
