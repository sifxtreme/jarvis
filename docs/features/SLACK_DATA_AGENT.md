# Slack Data Agent
Date: 2026-01-02

Query your Jarvis database using natural language in Slack.

Status: Future concept only. Not implemented in the current codebase.
Current Slack integration handles calendar event extraction via `SlackEventsController` + `SlackMessageJob`.

## Product Vision

Ask questions in Slack like:
- "how much did I spend at restaurants last month?"
- "top 5 merchants by spending in 2024"
- "what's my average monthly grocery spend?"
- "show me all hidden transactions"

Get instant answers as formatted Slack messages or CSV attachments.

## Inspiration

This feature is inspired by [Sidequery's Slack Data Agent](https://sidequery.dev/blog/slack-data-agent), which combines:
- **Slack Socket Mode** for real-time bot communication
- **DuckDB + ACP extension** for AI-powered SQL generation
- **Claude Code** for natural language understanding

Their architecture: User mentions bot → DuckDB with ACP extension → Claude explores schema via `run_sql` tool → iterates on query → returns results via `final_query` tool.

Key insight from their implementation: The AI needs **two tools**:
1. `run_sql` - explore schema, test queries, iterate on errors
2. `final_query` - return the completed query results

This allows the AI to self-correct and refine queries before returning results.

## Proposed Implementation (Rails + Gemini)

We adapt this for our simpler stack without DuckDB:

```
Slack @mention → Rails webhook →
  Gemini Flash (NL→SQL with schema context) →
  PostgreSQL (read-only query) →
  Format results → Slack reply
```

### Why Gemini Flash?
- **10x cheaper** than Claude: ~$0.002 per query vs ~$0.02
- Already planned for Jarvis Chat feature
- Good at structured output (JSON mode)
- Fast (2-3 second responses)

### Why Not DuckDB/ACP?
- Adds complexity (Rust extension, ACP protocol)
- Our schema is simple (2 main tables)
- Don't need the full agent loop for straightforward queries
- Can add iterative refinement later if needed

---

## Technical Architecture

### Slack Integration Options

#### Option 1: Events API (Webhook) - Recommended
```
Slack Event → POST /slack/events → Rails Controller → Background Job → Slack API reply
```

**Pros:**
- Simple HTTP webhooks
- Easy to deploy (any Rails host)
- No persistent connections needed

**Cons:**
- Requires public URL
- Must respond within 3 seconds (need background job)
- Need to verify Slack signatures

#### Option 2: Socket Mode
```
Rails process ←WebSocket→ Slack
```

**Pros:**
- No public URL needed
- Real-time bidirectional
- Works behind firewalls

**Cons:**
- Requires persistent process
- More complex setup
- "If your machine sleeps, the bot sleeps"

**Recommendation:** Events API with webhook. Simpler, more reliable, works with existing Rails deployment.

### Ruby Gems

For Events API approach:
```ruby
# Gemfile
gem 'slack-ruby-client'  # API calls to post messages
gem 'rack-slack_request_verification'  # Verify request signatures
```

For Socket Mode (if needed later):
```ruby
gem 'slack-ruby-socket-mode-bot'  # Released Oct 2024, actively maintained
```

---

## Database Schema Context

The AI needs schema information to generate accurate SQL. Our queryable tables:

### `financial_transactions` (Primary)
```sql
CREATE TABLE financial_transactions (
  id SERIAL PRIMARY KEY,
  plaid_id VARCHAR(255),          -- External transaction ID
  plaid_name VARCHAR(255),        -- Raw name from bank
  merchant_name VARCHAR(255),     -- Cleaned merchant name
  category VARCHAR(255),          -- e.g., "Food & Drink", "Shopping"
  source VARCHAR(255),            -- e.g., "amex", "teller", "plaid"
  amount DECIMAL(8,2),            -- Transaction amount
  transacted_at TIMESTAMP,        -- When transaction occurred
  hidden BOOLEAN DEFAULT false,   -- Excluded from reports
  reviewed BOOLEAN DEFAULT false, -- Manually reviewed
  raw_data JSONB DEFAULT '{}'     -- Full API response
);

-- Indexes for common queries
CREATE INDEX ON financial_transactions(category);
CREATE INDEX ON financial_transactions(merchant_name);
CREATE INDEX ON financial_transactions(transacted_at);
CREATE INDEX ON financial_transactions(hidden);
```

### `budgets`
```sql
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,             -- Budget category name
  valid_starting_at TIMESTAMP,    -- Budget period start
  valid_ending_at TIMESTAMP,      -- Budget period end (null = ongoing)
  amount DECIMAL NOT NULL,        -- Budget amount
  expense_type VARCHAR NOT NULL,  -- Type of expense
  display_order INTEGER DEFAULT 0
);
```

### Schema Representation for LLM

Provide as structured context:

```
Database Schema:

Table: financial_transactions
- id: integer (primary key)
- merchant_name: string (cleaned merchant name, e.g., "Whole Foods", "Amazon")
- plaid_name: string (raw bank description)
- category: string (e.g., "Food & Drink", "Shopping", "Travel", "Entertainment")
- source: string (bank source: "amex", "teller", "plaid", "chase")
- amount: decimal (transaction amount, positive = expense)
- transacted_at: timestamp (when transaction occurred)
- hidden: boolean (true = excluded from reports)
- reviewed: boolean (true = manually verified)

Table: budgets
- id: integer (primary key)
- name: string (budget category)
- amount: decimal (monthly budget amount)
- expense_type: string (category type)
- valid_starting_at: timestamp (budget start date)
- valid_ending_at: timestamp (budget end date, null = ongoing)

Common query patterns:
- Filter by date: WHERE transacted_at >= '2024-01-01' AND transacted_at < '2024-02-01'
- Exclude hidden: WHERE hidden = false
- Group by category: GROUP BY category
- Group by merchant: GROUP BY merchant_name
- Monthly aggregation: DATE_TRUNC('month', transacted_at)
```

---

## Implementation Details

### 1. Slack App Setup

Create app at [api.slack.com/apps](https://api.slack.com/apps):

**App Manifest (YAML):**
```yaml
display_information:
  name: Jarvis Finance Bot
  description: Query your finances with natural language
  background_color: "#1a1a2e"

features:
  bot_user:
    display_name: jarvis-finance
    always_online: false

oauth_config:
  scopes:
    bot:
      - app_mentions:read    # Receive @mention events
      - chat:write           # Post messages
      - files:write          # Upload CSV files

settings:
  event_subscriptions:
    request_url: https://your-domain.com/slack/events
    bot_events:
      - app_mention
  interactivity:
    is_enabled: false
  org_deploy_enabled: false
  socket_mode_enabled: false
```

**Required Tokens:**
- `SLACK_BOT_TOKEN` (xoxb-...) - OAuth & Permissions page
- `SLACK_SIGNING_SECRET` - Basic Information page

### 2. Rails Controller (Concept)

```ruby
# app/controllers/slack_controller.rb
class SlackController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :verify_slack_request

  def events
    case params[:type]
    when 'url_verification'
      # Slack verifies our endpoint on setup
      render json: { challenge: params[:challenge] }
    when 'event_callback'
      handle_event(params[:event])
      head :ok  # Respond immediately, process async
    else
      head :ok
    end
  end

  private

  def verify_slack_request
    # Use rack-slack_request_verification gem or manual verification
    timestamp = request.headers['X-Slack-Request-Timestamp']
    signature = request.headers['X-Slack-Signature']

    # Reject old timestamps (replay attack prevention)
    if (Time.now.to_i - timestamp.to_i).abs > 300
      head :unauthorized
      return
    end

    # Compute expected signature
    sig_basestring = "v0:#{timestamp}:#{request.raw_post}"
    expected = 'v0=' + OpenSSL::HMAC.hexdigest(
      'SHA256',
      ENV['SLACK_SIGNING_SECRET'],
      sig_basestring
    )

    unless ActiveSupport::SecurityUtils.secure_compare(expected, signature)
      head :unauthorized
    end
  end

  def handle_event(event)
    return if event[:bot_id].present?  # Ignore bot messages (prevent loops)

    case event[:type]
    when 'app_mention'
      # Extract the question (remove the @mention)
      question = event[:text].gsub(/<@[A-Z0-9]+>/, '').strip

      # Process async to meet 3-second requirement
      SlackQueryJob.perform_async(
        channel: event[:channel],
        thread_ts: event[:ts],  # Reply in thread
        question: question,
        user: event[:user]
      )
    end
  end
end
```

### 3. Background Job

```ruby
# app/jobs/slack_query_job.rb
class SlackQueryJob
  include Resque::Plugins::UniqueJob
  @queue = :slack

  def self.perform(channel:, thread_ts:, question:, user:)
    # 1. Generate SQL from natural language
    result = NaturalLanguageQuery.new(question).execute

    # 2. Post result to Slack
    slack_client = Slack::Web::Client.new(token: ENV['SLACK_BOT_TOKEN'])

    case result
    when NaturalLanguageQuery::Success
      if result.row_count > 10
        # Upload as CSV file for large results
        slack_client.files_upload_v2(
          channel: channel,
          thread_ts: thread_ts,
          content: result.to_csv,
          filename: "query_results.csv",
          initial_comment: "Found #{result.row_count} results for: _#{question}_"
        )
      else
        # Post as formatted message for small results
        slack_client.chat_postMessage(
          channel: channel,
          thread_ts: thread_ts,
          text: format_results(question, result),
          mrkdwn: true
        )
      end
    when NaturalLanguageQuery::Error
      slack_client.chat_postMessage(
        channel: channel,
        thread_ts: thread_ts,
        text: ":warning: Sorry, I couldn't process that query: #{result.message}"
      )
    end
  end

  def self.format_results(question, result)
    <<~SLACK
      *Query:* _#{question}_

      #{result.formatted_table}

      _#{result.row_count} rows • Generated in #{result.duration}s_
    SLACK
  end
end
```

### 4. Natural Language Query Service

```ruby
# app/services/natural_language_query.rb
class NaturalLanguageQuery
  SCHEMA_CONTEXT = <<~SCHEMA
    You are a SQL query generator for a personal finance database.

    Available tables:

    Table: financial_transactions
    Columns:
    - id: integer (primary key)
    - merchant_name: string (e.g., "Whole Foods", "Amazon", "Uber")
    - plaid_name: string (raw bank description, use merchant_name instead when possible)
    - category: string (e.g., "Food & Drink", "Shopping", "Travel", "Entertainment", "Groceries")
    - source: string (bank source: "amex", "teller", "chase")
    - amount: decimal (transaction amount in dollars)
    - transacted_at: timestamp (when transaction occurred)
    - hidden: boolean (true = excluded from reports, usually filter these out)
    - reviewed: boolean (true = manually verified)

    Table: budgets
    Columns:
    - id: integer
    - name: string (budget category name)
    - amount: decimal (monthly budget amount)
    - expense_type: string
    - valid_starting_at: timestamp
    - valid_ending_at: timestamp (null means ongoing)

    Important notes:
    - Always exclude hidden transactions (WHERE hidden = false) unless asked about hidden ones
    - Use merchant_name for grouping/filtering merchants
    - Common categories: "Food & Drink", "Shopping", "Travel", "Entertainment", "Groceries", "Transportation"
    - Current date: #{Date.today}
    - For "last month" use the previous calendar month
    - For "this year" use the current calendar year

    Return ONLY a valid PostgreSQL SELECT query. No explanations.
    The query must be read-only (SELECT only, no INSERT/UPDATE/DELETE).
  SCHEMA

  Success = Struct.new(:rows, :columns, :row_count, :duration, :sql, keyword_init: true) do
    def to_csv
      CSV.generate do |csv|
        csv << columns
        rows.each { |row| csv << row.values }
      end
    end

    def formatted_table
      return "_No results_" if rows.empty?

      # Format as Slack code block with aligned columns
      header = columns.join(" | ")
      separator = columns.map { |c| "-" * c.length }.join("-|-")
      body = rows.first(10).map { |r| r.values.join(" | ") }.join("\n")

      "```\n#{header}\n#{separator}\n#{body}\n```"
    end
  end

  Error = Struct.new(:message, keyword_init: true)

  def initialize(question)
    @question = question
  end

  def execute
    start_time = Time.current

    # Step 1: Generate SQL from natural language
    sql = generate_sql
    return Error.new(message: "Couldn't understand the question") unless sql

    # Step 2: Validate SQL is read-only
    return Error.new(message: "Only SELECT queries are allowed") unless read_only?(sql)

    # Step 3: Execute query with timeout
    result = execute_sql(sql)

    Success.new(
      rows: result,
      columns: result.first&.keys || [],
      row_count: result.size,
      duration: (Time.current - start_time).round(2),
      sql: sql
    )
  rescue ActiveRecord::StatementInvalid => e
    Error.new(message: "Query error: #{e.message.split("\n").first}")
  rescue => e
    Rails.logger.error("NaturalLanguageQuery error: #{e.message}")
    Error.new(message: "An error occurred processing your query")
  end

  private

  def generate_sql
    response = GeminiClient.generate(
      model: 'gemini-2.0-flash',
      prompt: "#{SCHEMA_CONTEXT}\n\nUser question: #{@question}",
      response_format: { type: 'text' }  # Plain text, not JSON
    )

    # Extract SQL from response (handle markdown code blocks)
    sql = response.strip
    sql = sql.gsub(/```sql\n?/, '').gsub(/```\n?/, '')
    sql.strip
  end

  def read_only?(sql)
    normalized = sql.downcase.gsub(/\s+/, ' ')

    # Reject mutation keywords
    forbidden = %w[insert update delete drop alter create truncate grant revoke]
    forbidden.none? { |keyword| normalized.include?(keyword) }
  end

  def execute_sql(sql)
    # Use a read-only connection if available, with timeout
    ActiveRecord::Base.connection.execute(
      "SET statement_timeout = '10s'; #{sql}"
    ).to_a
  end
end
```

### 5. Gemini Client

Reuse the client from Jarvis Chat (see `JARVIS_CHAT.md`):

```ruby
# app/services/gemini_client.rb
class GeminiClient
  API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

  def self.generate(model:, prompt:, response_format: nil)
    uri = URI("#{API_URL}/#{model}:generateContent?key=#{ENV['GEMINI_API_KEY']}")

    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,  # Low temperature for deterministic SQL
        maxOutputTokens: 500
      }
    }

    if response_format&.dig(:type) == 'json'
      body[:generationConfig][:responseMimeType] = 'application/json'
    end

    response = Net::HTTP.post(
      uri,
      body.to_json,
      'Content-Type' => 'application/json'
    )

    parsed = JSON.parse(response.body)
    parsed.dig('candidates', 0, 'content', 'parts', 0, 'text')
  end
end
```

---

## Security Considerations

### 1. Read-Only Enforcement

**Multiple layers of protection:**

```ruby
# Layer 1: SQL validation in NaturalLanguageQuery
def read_only?(sql)
  forbidden = %w[insert update delete drop alter create truncate]
  forbidden.none? { |k| sql.downcase.include?(k) }
end

# Layer 2: Database user with read-only permissions
# In PostgreSQL:
# CREATE USER jarvis_readonly WITH PASSWORD 'xxx';
# GRANT CONNECT ON DATABASE jarvis TO jarvis_readonly;
# GRANT USAGE ON SCHEMA public TO jarvis_readonly;
# GRANT SELECT ON ALL TABLES IN SCHEMA public TO jarvis_readonly;

# Layer 3: Separate database connection
class ReadOnlyBase < ApplicationRecord
  self.abstract_class = true
  establish_connection :readonly  # config/database.yml
end
```

### 2. Query Timeout

Prevent runaway queries:
```ruby
# Set statement timeout for each query
ActiveRecord::Base.connection.execute("SET statement_timeout = '10s'")
```

### 3. Result Size Limits

```ruby
# Limit result size
sql_with_limit = "#{sql} LIMIT 1000" unless sql.downcase.include?('limit')
```

### 4. Slack Request Verification

Always verify the `X-Slack-Signature` header to ensure requests come from Slack.

### 5. Rate Limiting

```ruby
# In SlackController
def handle_event(event)
  # Rate limit per user
  rate_key = "slack_query:#{event[:user]}"

  if Rails.cache.read(rate_key).to_i >= 10
    # Reply with rate limit message
    return
  end

  Rails.cache.increment(rate_key, 1, expires_in: 1.minute)
  # ... process query
end
```

---

## Example Queries & Expected SQL

| Natural Language | Generated SQL |
|-----------------|---------------|
| "how much did I spend last month?" | `SELECT SUM(amount) as total FROM financial_transactions WHERE hidden = false AND transacted_at >= '2024-11-01' AND transacted_at < '2024-12-01'` |
| "top 5 merchants by spending" | `SELECT merchant_name, SUM(amount) as total FROM financial_transactions WHERE hidden = false GROUP BY merchant_name ORDER BY total DESC LIMIT 5` |
| "show me all Amazon transactions" | `SELECT * FROM financial_transactions WHERE hidden = false AND merchant_name ILIKE '%amazon%' ORDER BY transacted_at DESC` |
| "monthly spending by category this year" | `SELECT DATE_TRUNC('month', transacted_at) as month, category, SUM(amount) as total FROM financial_transactions WHERE hidden = false AND transacted_at >= '2024-01-01' GROUP BY month, category ORDER BY month, total DESC` |
| "average transaction amount" | `SELECT AVG(amount) as average FROM financial_transactions WHERE hidden = false` |
| "what are my hidden transactions?" | `SELECT * FROM financial_transactions WHERE hidden = true ORDER BY transacted_at DESC` |

---

## Iterative Query Refinement (Future Enhancement)

The Sidequery approach uses two tools (`run_sql` + `final_query`) to let the AI iterate and self-correct. We can add this later:

```ruby
class IterativeNaturalLanguageQuery
  MAX_ITERATIONS = 3

  def execute
    messages = [
      { role: 'system', content: system_prompt },
      { role: 'user', content: @question }
    ]

    MAX_ITERATIONS.times do
      response = call_gemini_with_tools(messages)

      case response[:tool]
      when 'run_sql'
        # Execute exploratory query, add result to context
        result = safe_execute(response[:sql])
        messages << { role: 'assistant', content: response[:raw] }
        messages << { role: 'tool', content: format_result(result) }
      when 'final_query'
        # Return final result to user
        return Success.new(rows: safe_execute(response[:sql]))
      end
    end

    Error.new(message: "Couldn't generate a valid query after #{MAX_ITERATIONS} attempts")
  end

  def system_prompt
    <<~PROMPT
      #{SCHEMA_CONTEXT}

      You have two tools:

      1. run_sql(query) - Run a query to explore the schema or test your query.
         Use this to check table structure, see sample data, or validate your approach.

      2. final_query(query) - Return the final query results to the user.
         Only use this when you're confident the query is correct.

      Strategy:
      1. If unsure about schema, run exploratory queries first
      2. Test complex queries with LIMIT 1 before final execution
      3. If a query fails, analyze the error and try again
    PROMPT
  end
end
```

---

## Implementation Phases

### Phase 1: Basic Bot (4-6 hours)
- [ ] Create Slack app with manifest
- [ ] Implement `/slack/events` endpoint with signature verification
- [ ] Basic NaturalLanguageQuery service with Gemini
- [ ] Post text results to Slack thread
- [ ] Deploy and test

### Phase 2: Enhanced Results (2-3 hours)
- [ ] CSV file upload for large results
- [ ] Formatted tables for small results
- [ ] Error handling and user-friendly messages
- [ ] Rate limiting

### Phase 3: Security Hardening (2-3 hours)
- [ ] Read-only database user
- [ ] Query timeout enforcement
- [ ] Result size limits
- [ ] Audit logging

### Phase 4: Advanced Features (Optional, 4-6 hours)
- [ ] Iterative query refinement (two-tool approach)
- [ ] Query history/favorites
- [ ] Suggested queries based on common patterns
- [ ] Charts/visualizations via Slack Block Kit

---

## Cost Estimate

**Per Query:**
- Gemini 2.0 Flash: ~$0.002 (schema context + question + SQL output)
- Slack API: Free

**Monthly (assuming 100 queries/month):**
- Gemini: ~$0.20/month
- Essentially free for personal use

---

## Alternative Approaches Considered

### 1. DuckDB with ACP Extension
**Pros:** Full agent loop, proven architecture, works with Claude Code
**Cons:** Complex setup (Rust extension, ACP protocol), overkill for simple schema

### 2. Direct Claude API
**Pros:** Better reasoning, tool use built-in
**Cons:** 10x more expensive than Gemini Flash

### 3. Fine-tuned Model
**Pros:** Better accuracy for our specific schema
**Cons:** Requires training data, maintenance overhead

### 4. Pre-built Solutions (AI2SQL, Gumloop)
**Pros:** No code required
**Cons:** Less control, potential costs, privacy concerns

**Our choice:** Gemini Flash with simple prompt engineering strikes the best balance of cost, simplicity, and control for a personal finance app.

---

## References

- [Sidequery Blog: Slack Data Agent](https://sidequery.dev/blog/slack-data-agent)
- [DuckDB ACP Extension](https://github.com/sidequery/duckdb-acp)
- [Slack Events API](https://docs.slack.dev/apis/events-api/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Best Practices for Text-to-SQL (AWS)](https://aws.amazon.com/blogs/machine-learning/generating-value-from-enterprise-data-best-practices-for-text2sql-and-generative-ai/)
- [slack-ruby-client gem](https://github.com/slack-ruby/slack-ruby-client)
- [slack-ruby-socket-mode-bot gem](https://github.com/guille/slack-socket-mode-bot)
