# AI Implementation Patterns & Best Practices

**Date:** January 10, 2026
**Purpose:** A reference guide for implementing advanced AI features ("Pro" level) specifically tailored for the Jarvis architecture (Rails/EC2).

## 1. The "Butler's Notebook" (Memory Triage)

The "Stevens" pattern involves using a single, flexible table for memories. As this table grows, sending recent history is insufficient, and sending everything is too expensive.

### The Problem
*   **Context Window:** LLMs have limits (cost/size). You cannot send 5,000 past memories in every prompt.
*   **Relevance:** Recency bias (just looking at the last 10 messages) fails when the user asks about something from 3 months ago (e.g., "What was the name of that contractor?").

### The Solution: Semantic Hybrid Search
Don't just rely on keyword search or simple history.
1.  **Keyword Search:** Good for specific names or IDs ("Soccer", "Invoice #123").
2.  **Vector Search (Semantic):** Good for meaning. A search for "home repairs" should find "plumber", "roof leak", and "contractor" even if the words don't match.
3.  **Context Injection:**
    *   Query `pgvector` for the top 5 most semantically similar memories.
    *   Inject these 5 memories into the **System Prompt** dynamically.
    *   *Result:* The bot feels like it has a "perfect memory" of your entire life.

## 2. Proactive "Push" Agents (The Assistant vs. The Butler)

A standard chatbot is **Reactive** (it waits for you to type). A true Butler is **Proactive** (it notices things and alerts you).

### The Architecture
Use the existing **Redis/Resque** setup for "Background Reasoning."
*   **Monitor:** A scheduled job (e.g., `DailyFinanceCheckJob`) runs every morning.
*   **Analyze:** It queries the `FinancialTransaction` table.
    *   *Logic:* "Is current month spending > last month spending by 20%?"
*   **Act:** It pushes a message to you (via Slack/SMS).
    *   *Message:* "Hey, you're trending high on groceries this week. Want to see the breakdown?"

### Impact
This shifts the mental load from the User ("I need to check my budget") to the Bot ("The bot will tell me if something is wrong").

## 3. The "Tool-User" (Agency via Function Calling)

Currently, the bot "extracts" data (JSON) and our code decides what to do. The modern standard is **Agency**.

### The Way
Instead of the bot asking "Should I add it?", you give the bot a **Tool**.
*   **Definition:** You define a Ruby method `create_google_event(title, date, attendees)`.
*   **Interface:** You pass this definition (JSON Schema) to Gemini API.
*   **Execution:**
    1.  User: "Schedule lunch with Mom."
    2.  Gemini Response: `ToolCall: create_google_event(title="Lunch", date="2026-01-12")` (Not text!)
    3.  Rails App: Executes the Ruby method.
    4.  Rails App: Sends result back to Gemini.
    5.  Gemini: "Done, I've added that to your calendar."

This reduces hallucination because the bot is constrained to valid API calls only.

## 4. Human-in-the-Loop (HITL) for Actions

For high-stakes tasks (paying bills, sending emails), the bot should **Draft**, not Execute.

### The Workflow
1.  **Trigger:** Jarvis reads an email: "School Invoice: $50 for Pizza Day."
2.  **Draft:** It prepares the transaction or payment logic but does *not* run it.
3.  **Prompt:** It sends a Slack message using **Block Kit**:
    *   "Found a school invoice for $50. Pay it now?"
    *   [ Button: Approve ]  [ Button: Ignore ]
4.  **Execute:** Only when you tap "Approve" does the Rails app hit the payment API.

## 5. Strategic Roadmap (Next Steps)

Given the current state (Rails 5.2 on EC2), here is the specific order of operations to achieve this vision:

1.  **Infrastructure Foundation (The "Brain" Upgrade):**
    *   **Action:** Install `pgvector` on the EC2 Postgres instance.
    *   **Why:** Turns your database into a Knowledge Base.

2.  **Modernization (The "Body" Upgrade):**
    *   **Action:** Upgrade to **Rails 7.1**.
    *   **Why:** Rails 7.1 has native `Solid Queue` and `ActionCable` improvements that make building "Proactive Push" and "Streaming" features significantly easier and more stable than the old Redis/Resque setup.

3.  **Feature Rollout:**
    *   Start with **Memory Triage** (easiest win with pgvector).
    *   Then build **Proactive Alerts** (simple cron jobs).
    *   Finally, refactor chat to use **Function Calling** (simplifies the codebase).
