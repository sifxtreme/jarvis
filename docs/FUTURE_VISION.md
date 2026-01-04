# Jarvis: Future Vision & Implementation Plan
Date: 2026-01-02

> "The single most commercially valuable application of LLMs is turning unstructured content into structured data." — [Simon Willison](https://simonwillison.net/2025/Feb/28/llm-schemas/)

Status: Vision document. Most items are not implemented in the current codebase.

Jarvis evolves from a finance tracker into a true personal AI assistant — your digital butler for life's recurring tasks. Inspired by [Geoffrey Litt's Stevens](https://www.geoffreylitt.com/2025/04/12/how-i-made-a-useful-ai-assistant-with-one-sqlite-table-and-a-handful-of-cron-jobs), we embrace simplicity: one flexible memory table, cron jobs for data ingestion, and LLMs to make sense of it all.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Screenshot → Calendar Events](#screenshot-to-calendar-events)
3. [Email Triage & Analysis](#email-triage--analysis)
4. [Calendar Intelligence](#calendar-intelligence)
5. [Household Management](#household-management)
6. [Grocery & Meal Planning](#grocery--meal-planning)
7. [Family Hub](#family-hub)
8. [Memory & Preferences System](#memory--preferences-system)
9. [Daily Briefings](#daily-briefings)
10. [Technical Implementation](#technical-implementation)
11. [API Integrations](#api-integrations)
12. [Phased Rollout](#phased-rollout)

---

## Core Architecture

### The Butler's Notebook Pattern

Following Stevens' approach, Jarvis uses a single `memories` table as its "butler's notebook":

```ruby
# db/migrate/xxx_create_memories.rb
create_table :memories do |t|
  t.text :content, null: false           # Free-form text (LLM interprets meaning)
  t.string :category                      # finance, calendar, email, household, family, etc.
  t.string :source                        # teller, gmail, gcal, manual, screenshot, etc.
  t.date :relevant_date                   # When is this memory relevant? (nullable = always)
  t.date :expiry_date                     # When does this become irrelevant?
  t.jsonb :metadata, default: {}          # Structured data for programmatic access
  t.references :family_member, optional: true  # Link to specific person
  t.timestamps
end
```

### Why This Works

1. **LLMs are flexible** — They can interpret "Pick up [kid] from soccer at 4pm Tuesday" without rigid schemas
2. **Easy to extend** — New data sources just write to the same table
3. **Context windows are huge** — Claude handles 200K tokens; we can load weeks of context
4. **Simple to query** — `Memory.where(relevant_date: Date.today..7.days.from_now)`

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Data Sources  │────▶│   Cron Jobs     │────▶│   Memories DB   │
│                 │     │   (Importers)   │     │                 │
│ • Gmail         │     │                 │     │ • Unified store │
│ • Google Cal    │     │ • Sync hourly   │     │ • Date-indexed  │
│ • Screenshots   │     │ • Parse & store │     │ • LLM-readable  │
│ • Teller        │     │                 │     │                 │
│ • Manual input  │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Query    │────▶│   LLM Engine    │────▶│   Response      │
│                 │     │                 │     │                 │
│ • "What's today"│     │ • Load context  │     │ • Daily brief   │
│ • Screenshot    │     │ • Claude API    │     │ • Actions taken │
│ • Voice/Text    │     │ • Tool calling  │     │ • Reminders     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Screenshot → Calendar Events

### The Vision

Forward a screenshot of an event flyer, text message, or email → Jarvis extracts the details → Creates a Google Calendar event → Confirms with you.

### How It Works

```ruby
# POST /api/screenshots
# Accepts: multipart/form-data with image

class ScreenshotsController < ApplicationController
  def create
    image_data = Base64.encode64(params[:image].read)

    # Use Claude's vision to extract event details
    response = Claude.messages.create(
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: image_data }},
          { type: "text", text: <<~PROMPT }
            Extract calendar event details from this image. Return JSON:
            {
              "title": "Event name",
              "start_time": "ISO 8601 datetime",
              "end_time": "ISO 8601 datetime or null",
              "location": "Address or null",
              "description": "Any additional details",
              "confidence": 0.0-1.0
            }
            If no event is found, return {"error": "No event detected"}
          PROMPT
        ]
      }]
    )

    event_data = JSON.parse(response.content[0].text)

    if event_data["confidence"] > 0.7
      # Create Google Calendar event
      calendar_event = GoogleCalendar.create_event(event_data)

      # Store in memories
      Memory.create!(
        content: "Created calendar event: #{event_data['title']} on #{event_data['start_time']}",
        category: 'calendar',
        source: 'screenshot',
        relevant_date: Date.parse(event_data['start_time']),
        metadata: event_data
      )

      render json: { success: true, event: calendar_event }
    else
      render json: { success: false, needs_confirmation: true, extracted: event_data }
    end
  end
end
```

### Input Channels

| Channel | Implementation |
|---------|----------------|
| **Telegram Bot** | Forward images directly to Jarvis bot |
| **Email** | Send screenshots to jarvis@yourdomain.com |
| **Web Upload** | Drag-and-drop in Jarvis web UI |
| **iOS Shortcut** | Share sheet → "Send to Jarvis" |
| **SMS/MMS** | Twilio webhook for incoming images |

### Supported Screenshot Types

- Event flyers and posters
- Text message conversations with plans
- Email event invitations
- School newsletters
- Sports schedules
- Restaurant reservations
- Flight/hotel confirmations
- Concert/movie tickets

### Reference: [Screenshot to Calendar](https://www.screentocal.com/)

---

## Email Triage & Analysis

### The Vision

Jarvis reads your important emails, identifies actionable items, and either handles them or creates tasks for you.

### Gmail Integration

```ruby
# lib/gmail/importer.rb
class Gmail::Importer
  IMPORTANT_LABELS = ['IMPORTANT', 'STARRED', 'CATEGORY_PERSONAL']

  def sync
    messages = gmail_client.list_messages(
      'me',
      label_ids: IMPORTANT_LABELS,
      q: "after:#{1.day.ago.to_date}"
    )

    messages.each do |msg|
      full_message = gmail_client.get_message('me', msg.id)
      analyze_and_store(full_message)
    end
  end

  def analyze_and_store(message)
    # Extract email content
    content = extract_body(message)

    # Use Claude to analyze
    analysis = Claude.analyze(<<~PROMPT)
      Analyze this email and extract:
      1. Summary (1-2 sentences)
      2. Actionable items (tasks I need to do)
      3. Important dates/deadlines
      4. Category (school, health, finance, social, etc.)
      5. Priority (high/medium/low)
      6. Requires response? (yes/no)

      Email:
      From: #{message.from}
      Subject: #{message.subject}
      Body: #{content}
    PROMPT

    # Store in memories
    Memory.create!(
      content: analysis.summary,
      category: "email:#{analysis.category}",
      source: 'gmail',
      relevant_date: analysis.deadline || Date.today,
      metadata: {
        gmail_id: message.id,
        from: message.from,
        subject: message.subject,
        actions: analysis.actionable_items,
        priority: analysis.priority,
        requires_response: analysis.requires_response
      }
    )

    # Create tasks for actionable items
    analysis.actionable_items.each do |action|
      create_task(action, deadline: analysis.deadline)
    end
  end
end
```

### What Jarvis Looks For

| Category | Examples |
|----------|----------|
| **School** | Permission slips, picture day, early dismissal, parent-teacher conferences |
| **Health** | Appointment reminders, prescription refills, vaccination schedules |
| **Finance** | Bills due, subscription renewals, bank alerts |
| **Household** | Package deliveries, service appointments, HOA notices |
| **Social** | Party invitations, playdate requests, family gatherings |
| **Kids' Activities** | Practice schedules, game times, registration deadlines |

### Action Types

```ruby
module Email::Actions
  NOTIFY = 'notify'           # Just tell me about it
  REMIND = 'remind'           # Remind me before deadline
  RESPOND = 'respond'         # Draft a response
  CALENDAR = 'calendar'       # Add to calendar
  TASK = 'task'               # Create a to-do
  PAY = 'pay'                 # Bill to pay
  SIGN = 'sign'               # Document to sign
end
```

### Reference: [Email Agent (GitHub)](https://github.com/haasonsaas/email-agent)

---

## Calendar Intelligence

### The Vision

Jarvis knows your family's entire schedule, can answer questions about it, identifies conflicts, and suggests optimizations.

### Google Calendar Sync

```ruby
# lib/google_calendar/importer.rb
class GoogleCalendar::Importer
  # Sync all family calendars every hour
  CALENDARS = {
    'asif' => 'primary',
    'hafsa' => 'hafsa@family.com',
    'kids_activities' => 'calendar_id_here',
    'school' => 'school_calendar_id'
  }

  def sync
    CALENDARS.each do |name, calendar_id|
      events = calendar_client.list_events(
        calendar_id,
        time_min: Time.now.iso8601,
        time_max: 14.days.from_now.iso8601,
        single_events: true,
        order_by: 'startTime'
      )

      events.items.each do |event|
        Memory.find_or_create_by!(
          source: 'google_calendar',
          metadata: { google_event_id: event.id }
        ) do |m|
          m.content = format_event(event, name)
          m.category = 'calendar'
          m.relevant_date = event.start.date || event.start.date_time.to_date
          m.metadata = {
            google_event_id: event.id,
            calendar_owner: name,
            title: event.summary,
            location: event.location,
            start_time: event.start.date_time || event.start.date,
            end_time: event.end.date_time || event.end.date,
            recurring: event.recurring_event_id.present?
          }
        end
      end
    end
  end

  def format_event(event, owner)
    time = event.start.date_time&.strftime("%I:%M %p") || "All day"
    "#{owner}'s event: #{event.summary} at #{time}" +
      (event.location ? " - #{event.location}" : "")
  end
end
```

### Query Examples

> "What's on the calendar this week?"
> "When is [oldest]'s next soccer practice?"
> "Do we have any conflicts on Saturday?"
> "What time do I need to leave for the dentist?"

### Conflict Detection

```ruby
class Calendar::ConflictDetector
  def find_conflicts(date_range)
    events = Memory.where(category: 'calendar')
                   .where(relevant_date: date_range)

    conflicts = []
    events.group_by(&:relevant_date).each do |date, day_events|
      day_events.combination(2).each do |e1, e2|
        if times_overlap?(e1.metadata, e2.metadata)
          conflicts << { date: date, events: [e1, e2] }
        end
      end
    end

    conflicts
  end
end
```

### Reference: [Google Calendar MCP](https://github.com/nspady/google-calendar-mcp)

---

## Household Management

### The Vision

Jarvis tracks your home inventory, maintenance schedules, and helps coordinate household tasks.

### Home Inventory

```ruby
# db/migrate/xxx_create_home_items.rb
create_table :home_items do |t|
  t.string :name, null: false
  t.string :category                    # appliance, furniture, electronics, etc.
  t.string :location                    # kitchen, garage, master bedroom, etc.
  t.date :purchase_date
  t.decimal :purchase_price
  t.string :brand
  t.string :model_number
  t.string :serial_number
  t.date :warranty_expiry
  t.text :notes
  t.jsonb :maintenance_schedule, default: {}  # { "filter_change": "monthly", ... }
  t.string :manual_url
  t.string :photo_url
  t.timestamps
end

# Examples:
# - HVAC system (filter change reminders every 3 months)
# - Water heater (flush annually, 10-year lifespan)
# - Smoke detectors (battery change every 6 months)
# - Refrigerator water filter (every 6 months)
```

### Maintenance Reminders

```ruby
class Household::MaintenanceReminder
  SCHEDULES = {
    hvac_filter: { interval: 3.months, task: "Change HVAC filter" },
    smoke_detector_battery: { interval: 6.months, task: "Replace smoke detector batteries" },
    water_heater_flush: { interval: 1.year, task: "Flush water heater" },
    gutter_cleaning: { interval: 6.months, task: "Clean gutters" },
    dryer_vent: { interval: 1.year, task: "Clean dryer vent" },
    fridge_coils: { interval: 6.months, task: "Vacuum refrigerator coils" },
    garage_door: { interval: 1.year, task: "Lubricate garage door" },
    fire_extinguisher: { interval: 1.year, task: "Check fire extinguisher pressure" }
  }

  def generate_reminders
    SCHEDULES.each do |key, config|
      last_done = Memory.where(category: 'maintenance', metadata: { task_key: key })
                        .order(created_at: :desc).first

      if last_done.nil? || last_done.created_at < config[:interval].ago
        Memory.create!(
          content: "Home maintenance due: #{config[:task]}",
          category: 'maintenance',
          source: 'jarvis',
          relevant_date: Date.today,
          metadata: { task_key: key, task: config[:task] }
        )
      end
    end
  end
end
```

### Package Tracking

Jarvis monitors incoming emails for shipping notifications and tracks packages:

```ruby
class Shipping::Tracker
  CARRIERS = {
    'USPS' => /\b(9[0-9]{21}|[0-9]{20})\b/,
    'UPS' => /\b1Z[A-Z0-9]{16}\b/,
    'FedEx' => /\b[0-9]{12,22}\b/,
    'Amazon' => /TBA[0-9]{12,}/
  }

  def extract_from_email(email_content)
    CARRIERS.each do |carrier, pattern|
      if match = email_content.match(pattern)
        return { carrier: carrier, tracking_number: match[0] }
      end
    end
    nil
  end

  def track_and_notify(tracking_info)
    status = fetch_status(tracking_info)

    Memory.create!(
      content: "Package from #{tracking_info[:carrier]}: #{status[:description]}. " +
               "Expected: #{status[:eta]}",
      category: 'package',
      source: 'shipping',
      relevant_date: status[:eta],
      metadata: tracking_info.merge(status)
    )
  end
end
```

### Reference: [Homebox (Self-hosted inventory)](https://hay-kot.github.io/homebox/)

---

## Grocery & Meal Planning

### The Vision

Jarvis helps plan meals for the family, builds shopping lists based on preferences, and integrates with Instacart for delivery.

### Instacart Integration

The [Instacart Developer Platform (IDP)](https://www.instacart.com/company/business/developers) launched March 2024, providing API access to:
- 85,000+ stores across 1,500+ retailers
- Product catalog with nutrition data
- Cart building and checkout
- Same-day delivery scheduling

```ruby
# lib/instacart/client.rb
class Instacart::Client
  BASE_URL = 'https://connect.instacart.com/v1'

  def search_products(query, store_id: nil)
    post('/products/search', {
      query: query,
      store_id: store_id,
      include_nutrition: true
    })
  end

  def add_to_cart(product_ids)
    post('/cart/items', { items: product_ids.map { |id| { product_id: id, quantity: 1 } } })
  end

  def get_checkout_url
    post('/cart/checkout')[:checkout_url]
  end
end
```

### Meal Planning with Preferences

```ruby
# db/migrate/xxx_create_meal_preferences.rb
create_table :meal_preferences do |t|
  t.references :family_member
  t.string :preference_type  # allergy, dislike, diet, favorite
  t.string :item             # "peanuts", "broccoli", "vegetarian", "pizza"
  t.text :notes
  t.timestamps
end

# Family meal preferences example:
# [oldest] (9): dislikes mushrooms, loves pizza
# [middle] (7): allergic to tree nuts, loves pasta
# [youngest] (2): no spicy food, loves fruit
# [spouse]: vegetarian on weekdays
```

### Recipe & Grocery Integration

Using [Spoonacular API](https://spoonacular.com/food-api) for recipes:

```ruby
class MealPlanner
  def generate_weekly_plan
    # Get family preferences
    restrictions = MealPreference.where(preference_type: ['allergy', 'diet'])
                                 .pluck(:item)

    # Query Spoonacular for family-friendly recipes
    recipes = Spoonacular.search_recipes(
      diet: restrictions.join(','),
      number: 7,
      tags: 'kid-friendly,easy,30-minutes-or-less'
    )

    # Build grocery list
    ingredients = recipes.flat_map { |r| r[:ingredients] }
    grocery_list = consolidate_ingredients(ingredients)

    # Store meal plan
    recipes.each_with_index do |recipe, i|
      Memory.create!(
        content: "Dinner plan: #{recipe[:title]}",
        category: 'meal_plan',
        relevant_date: Date.today + i.days,
        metadata: {
          recipe_id: recipe[:id],
          title: recipe[:title],
          prep_time: recipe[:prep_time],
          ingredients: recipe[:ingredients],
          instructions_url: recipe[:url]
        }
      )
    end

    grocery_list
  end
end
```

### Smart Shopping List

```ruby
class GroceryList
  def generate
    # Items from meal plan
    meal_items = upcoming_meal_ingredients

    # Recurring items (based on purchase history)
    recurring = frequently_bought_items_due

    # Low stock items (from pantry inventory if tracked)
    low_stock = pantry_items_below_threshold

    # Combine and deduplicate
    all_items = (meal_items + recurring + low_stock).uniq

    # Group by store section
    categorize_by_aisle(all_items)
  end
end
```

### Reference: [Spoonacular API](https://spoonacular.com/food-api), [Instacart Developer Platform](https://docs.instacart.com/connect/)

---

## Family Hub

### The Vision

Jarvis knows each family member, their preferences, schedules, and needs. It's the digital brain of your household.

### Family Member Profiles

```ruby
# db/migrate/xxx_create_family_members.rb
create_table :family_members do |t|
  t.string :name, null: false
  t.string :nickname
  t.string :role                    # parent, child
  t.date :birthday
  t.integer :age                    # computed, for quick queries
  t.string :school_name
  t.string :grade
  t.string :teacher_name
  t.jsonb :preferences, default: {} # Favorite foods, colors, activities, etc.
  t.jsonb :medical, default: {}     # Allergies, medications, doctor info
  t.jsonb :sizes, default: {}       # Clothing sizes, shoe sizes
  t.timestamps
end

# Your family:
# - You (parent)
# - [spouse] (parent)
# - [oldest], 9 (4th grade)
# - [middle], 7 (2nd grade)
# - [youngest], 2 (toddler)
```

### Kids' Chore System

```ruby
# db/migrate/xxx_create_chores.rb
create_table :chores do |t|
  t.references :family_member
  t.string :name                    # "Make bed", "Feed dog", "Empty dishwasher"
  t.string :frequency               # daily, weekly, as_needed
  t.integer :points                 # Reward points
  t.string :days_of_week, array: true  # ["monday", "wednesday", "friday"]
  t.time :due_time
  t.timestamps
end

create_table :chore_completions do |t|
  t.references :chore
  t.references :family_member
  t.date :completed_date
  t.boolean :verified, default: false  # Parent verified?
  t.integer :points_earned
  t.timestamps
end
```

### Age-Appropriate Features

| Age | Jarvis Features |
|-----|-----------------|
| **[youngest] (2)** | Sleep schedule tracking, diaper inventory, developmental milestones |
| **[middle] (7)** | Homework reminders, reading log, playdate coordination |
| **[oldest] (9)** | Chore tracking, screen time limits, sports schedule |

### School Integration

```ruby
class School::Importer
  # Parse school newsletter emails
  def parse_newsletter(email)
    events = Claude.extract(email.body, schema: {
      events: [{ name: :string, date: :date, time: :time, notes: :string }],
      reminders: [{ item: :string, due_date: :date }],
      spirit_days: [{ theme: :string, date: :date }]
    })

    events[:events].each do |event|
      Memory.create!(
        content: "School event: #{event[:name]}",
        category: 'school',
        relevant_date: event[:date],
        metadata: event.merge(source: 'newsletter')
      )
    end
  end
end
```

### Reference: [Goldee AI (Family Assistant)](https://www.goldee.ai), [Cozi Family Organizer](https://www.cozi.com/)

---

## Memory & Preferences System

### The Vision

Jarvis remembers everything you tell it and learns your preferences over time.

### Memory Types

| Type | Example | Storage |
|------|---------|---------|
| **Facts** | "[youngest] is allergic to eggs" | Permanent, `expiry_date: nil` |
| **Events** | "Soccer practice at 4pm Tuesday" | Expires after event |
| **Tasks** | "Buy birthday present for [oldest]" | Until completed |
| **Preferences** | "I prefer morning appointments" | Permanent, updateable |
| **Context** | "We're planning a trip to Disney" | Expires when trip ends |

### Natural Language Memory

```ruby
class Memory::Parser
  def store_from_message(message)
    # Use Claude to understand the message
    parsed = Claude.analyze(<<~PROMPT)
      Parse this message into a memory entry:
      "#{message}"

      Return JSON:
      {
        "content": "normalized memory content",
        "category": "one of: fact, event, task, preference, context",
        "relevant_date": "ISO date if applicable, null otherwise",
        "expiry_date": "ISO date if applicable, null for permanent",
        "family_member": "name if about specific person, null otherwise",
        "priority": "high/medium/low"
      }
    PROMPT

    Memory.create!(
      content: parsed[:content],
      category: parsed[:category],
      source: 'manual',
      relevant_date: parsed[:relevant_date],
      expiry_date: parsed[:expiry_date],
      family_member: FamilyMember.find_by(name: parsed[:family_member]),
      metadata: { priority: parsed[:priority], raw_input: message }
    )
  end
end
```

### Preference Learning

```ruby
class Preferences::Learner
  # Learn from user behavior
  def observe(action, context)
    case action
    when :calendar_created
      # User always schedules doctor appointments at 10am
      if context[:event_type] == 'medical' && context[:time] == '10:00'
        increment_preference('medical_appointment_time', '10:00')
      end
    when :grocery_ordered
      # Track frequently ordered items
      context[:items].each do |item|
        increment_preference('grocery_frequency', item)
      end
    end
  end

  def suggest(category)
    get_top_preferences(category, limit: 5)
  end
end
```

### Reference: [Geoffrey Litt's Stevens](https://www.geoffreylitt.com/2025/04/12/how-i-made-a-useful-ai-assistant-with-one-sqlite-table-and-a-handful-of-cron-jobs)

---

## Daily Briefings

### The Vision

Every morning, Jarvis sends a personalized briefing with everything you need to know for the day.

### Briefing Generation

```ruby
class DailyBriefing
  def generate
    context = gather_context

    prompt = <<~PROMPT
      You are Jarvis, a helpful family assistant for the Ahmed household.

      Today is #{Date.today.strftime("%A, %B %d, %Y")}.

      Here's what I know:
      #{context.to_json}

      Generate a friendly morning briefing that includes:
      1. Weather summary and clothing suggestions for the kids
      2. Today's schedule for each family member
      3. Any tasks or reminders due today
      4. Upcoming important dates this week
      5. Any actionable items from recent emails
      6. Fun fact or encouragement for the day

      Keep it concise but warm. Use bullet points.
    PROMPT

    Claude.generate(prompt)
  end

  def gather_context
    {
      weather: fetch_weather,
      calendar: Memory.where(category: 'calendar', relevant_date: Date.today..3.days.from_now),
      tasks: Memory.where(category: 'task', relevant_date: Date.today),
      emails: Memory.where(category: 'email', relevant_date: Date.today)
                    .where("metadata->>'priority' = ?", 'high'),
      reminders: Memory.where(category: 'reminder', relevant_date: Date.today),
      family: FamilyMember.all.map { |m| { name: m.name, birthday: m.birthday } }
    }
  end

  def deliver
    briefing = generate

    # Send via Telegram
    TelegramBot.send_message(chat_id: ENV['FAMILY_CHAT_ID'], text: briefing)

    # Also send via email
    BriefingMailer.morning_brief(briefing).deliver_now
  end
end
```

### Scheduled Delivery

```yaml
# config/resque_schedule.yml
morning_briefing:
  cron: "0 6 * * *"  # 6 AM daily
  class: "DailyBriefing"
  queue: high
  description: "Generate and send morning briefing"

evening_summary:
  cron: "0 20 * * *"  # 8 PM daily
  class: "EveningSummary"
  queue: low
  description: "Send tomorrow preview and today recap"
```

### Sample Briefing

```
Good morning, Ahmed family! ☀️

🌤️ WEATHER: 72°F and sunny today. Perfect for outdoor activities!
   Kids: Light jacket for morning, shorts are fine.

📅 TODAY'S SCHEDULE:
   • 8:00 AM - School drop-off
   • 10:30 AM - [youngest]'s music class
   • 3:30 PM - Pick up [middle] (early dismissal)
   • 4:00 PM - [oldest]'s soccer practice
   • 6:30 PM - Family dinner at home

✅ TO-DO TODAY:
   • Sign [middle]'s permission slip (due today!)
   • Pick up dry cleaning
   • Pay electric bill ($142 due)

📬 EMAIL ACTIONS NEEDED:
   • School picture day is Thursday - choose package

📆 THIS WEEK:
   • Friday: [oldest]'s birthday party at 3pm
   • Saturday: Family brunch with grandparents

💡 TIP: [oldest] has been reading 20 min/day for 5 days straight! 🌟
```

---

## Technical Implementation

### API Architecture

```
/api/v1/
├── /memories
│   ├── GET    /              # List memories with filters
│   ├── POST   /              # Create memory from text/voice
│   └── DELETE /:id           # Remove memory
│
├── /screenshots
│   └── POST   /              # Upload image for processing
│
├── /calendar
│   ├── GET    /events        # List upcoming events
│   ├── POST   /events        # Create event
│   └── GET    /conflicts     # Check for conflicts
│
├── /email
│   ├── GET    /actionable    # Get emails needing action
│   └── POST   /:id/actions   # Take action on email
│
├── /household
│   ├── GET    /inventory     # List home items
│   ├── POST   /inventory     # Add item
│   └── GET    /maintenance   # Get maintenance reminders
│
├── /grocery
│   ├── GET    /list          # Current shopping list
│   ├── POST   /list/items    # Add item
│   └── POST   /checkout      # Get Instacart checkout URL
│
├── /family
│   ├── GET    /members       # List family members
│   ├── GET    /:id           # Get member details
│   └── PUT    /:id           # Update member
│
├── /chores
│   ├── GET    /              # List chores
│   ├── POST   /:id/complete  # Mark complete
│   └── GET    /leaderboard   # Points leaderboard
│
├── /briefing
│   ├── GET    /today         # Get today's briefing
│   └── POST   /generate      # Force regenerate
│
└── /chat
    └── POST   /              # Natural language query
```

### LLM Integration Pattern

```ruby
class JarvisAI
  def query(user_message, context: {})
    # Build context from memories
    relevant_memories = Memory.where(relevant_date: Date.today..7.days.from_now)
                              .or(Memory.where(relevant_date: nil))
                              .limit(100)

    # Build tool definitions
    tools = [
      { name: 'create_calendar_event', description: '...', parameters: {...} },
      { name: 'add_to_grocery_list', description: '...', parameters: {...} },
      { name: 'send_reminder', description: '...', parameters: {...} },
      { name: 'search_memories', description: '...', parameters: {...} }
    ]

    response = Claude.messages.create(
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: JARVIS_SYSTEM_PROMPT,
      tools: tools,
      messages: [
        { role: 'user', content: build_context_message(relevant_memories) },
        { role: 'assistant', content: 'I understand the current context.' },
        { role: 'user', content: user_message }
      ]
    )

    # Handle tool calls
    if response.stop_reason == 'tool_use'
      execute_tools(response.content)
    end

    response.content
  end
end
```

### System Prompt

```ruby
JARVIS_SYSTEM_PROMPT = <<~PROMPT
  You are Jarvis, a helpful AI assistant for the family household.

  Family members:
  - You (dad): Software engineer, manages family tech and finances
  - [spouse] (mom): Works from home, primary school coordinator
  - [oldest] (9): 4th grader, loves soccer and video games
  - [middle] (7): 2nd grader, loves art and reading
  - [youngest] (2): Toddler, loves trucks and Bluey

  Your personality:
  - Warm, helpful, and proactive
  - Use casual but respectful language
  - Anticipate needs when possible
  - Keep responses concise unless asked for details
  - Use emojis sparingly but appropriately

  You have access to:
  - Family calendar and schedules
  - Email inbox (important messages only)
  - Shopping and meal planning
  - Home maintenance tracking
  - Kids' chores and activities

  Always prioritize:
  1. Family safety and wellbeing
  2. Not missing important events
  3. Reducing household stress
  4. Teaching kids responsibility
PROMPT
```

---

## API Integrations

### Required APIs

| API | Purpose | Pricing |
|-----|---------|---------|
| **Claude API** | LLM for reasoning & extraction | $3/$15 per 1M tokens |
| **Google Calendar** | Calendar sync & events | Free (Google Workspace) |
| **Gmail API** | Email reading & triage | Free (Google Workspace) |
| **OpenWeather** | Weather for briefings | Free tier: 1000 calls/day |
| **Instacart IDP** | Grocery ordering | Contact for pricing |
| **Spoonacular** | Recipe & nutrition data | Free tier: 150 calls/day |
| **Telegram Bot** | Messaging interface | Free |
| **Twilio** | SMS/MMS handling | Pay per message |

### API Setup Checklist

```bash
# Environment variables needed
CLAUDE_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENWEATHER_API_KEY=...
INSTACART_API_KEY=...
SPOONACULAR_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

---

## Phased Rollout

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create `memories` table and model
- [ ] Build basic memory CRUD API
- [ ] Set up Claude API integration
- [ ] Create `/chat` endpoint for natural language queries
- [ ] Basic web UI for testing

### Phase 2: Screenshot → Calendar (Weeks 3-4)
- [ ] Image upload endpoint
- [ ] Claude Vision integration for event extraction
- [ ] Google Calendar API integration
- [ ] Telegram bot for image forwarding
- [ ] Confirmation flow for low-confidence extractions

### Phase 3: Email Intelligence (Weeks 5-6)
- [ ] Gmail API OAuth setup
- [ ] Email sync cron job
- [ ] Action extraction with Claude
- [ ] Task creation from emails
- [ ] Priority inbox view

### Phase 4: Calendar Sync (Weeks 7-8)
- [ ] Google Calendar full sync
- [ ] Multi-calendar support (family members)
- [ ] Conflict detection
- [ ] Calendar query endpoint

### Phase 5: Daily Briefings (Weeks 9-10)
- [ ] Weather API integration
- [ ] Briefing generation logic
- [ ] Telegram delivery
- [ ] Email delivery option
- [ ] Evening summary

### Phase 6: Household Management (Weeks 11-12)
- [ ] Home inventory table
- [ ] Maintenance reminder system
- [ ] Package tracking from emails
- [ ] Warranty tracking

### Phase 7: Family Hub (Weeks 13-14)
- [ ] Family member profiles
- [ ] Chore system
- [ ] School integration (newsletter parsing)
- [ ] Kids' activity tracking

### Phase 8: Grocery & Meals (Weeks 15-16)
- [ ] Instacart API integration
- [ ] Spoonacular recipe integration
- [ ] Meal preference learning
- [ ] Smart shopping list generation

### Phase 9: Polish & Optimize (Weeks 17-18)
- [ ] Mobile-friendly UI
- [ ] Voice input (Whisper API)
- [ ] Performance optimization
- [ ] Memory cleanup jobs
- [ ] Cost optimization (caching, batching)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Events created from screenshots | 90% accuracy |
| Email triage accuracy | 85% correct prioritization |
| Morning briefing satisfaction | 4.5/5 rating |
| Missed family events | Zero |
| Time saved per week | 2+ hours |
| Grocery list accuracy | 95% relevant items |

---

## Resources & References

- [Geoffrey Litt: Stevens AI Assistant](https://www.geoffreylitt.com/2025/04/12/how-i-made-a-useful-ai-assistant-with-one-sqlite-table-and-a-handful-of-cron-jobs)
- [Screenshot to Calendar](https://www.screentocal.com/)
- [Instacart Developer Platform](https://www.instacart.com/company/business/developers)
- [Spoonacular Food API](https://spoonacular.com/food-api)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Gmail API](https://developers.google.com/gmail/api)
- [Claude API Documentation](https://docs.anthropic.com/)
- [Homebox (Self-hosted Inventory)](https://hay-kot.github.io/homebox/)
- [Email Agent (GitHub)](https://github.com/haasonsaas/email-agent)
- [Ohai.ai Family Assistant](https://www.ohai.ai)
- [Goldee AI](https://www.goldee.ai)

---

## Skylight-Style Family Display

### The Vision

Build our own [Skylight Calendar](https://myskylight.com/calendar/) experience — a central family hub display — but self-hosted and without the $79/year subscription.

### What Skylight Does (That We Want)

| Feature | Skylight | Jarvis Implementation |
|---------|----------|----------------------|
| **Color-coded family calendar** | Per-person colors, day/week/month views | React dashboard + Google Calendar sync |
| **Chore charts with rewards** | Star incentives, kids check off tasks | Gamified chore system with points |
| **Meal planning** | Weekly meals, recipe storage, AI suggestions | Spoonacular + family preferences |
| **Grocery list → Instacart** | 2-tap ordering | Instacart IDP integration |
| **Recipe import** | AI recipe parsing | Claude Vision for recipe screenshots |
| **Shared lists** | Grocery, to-do, custom | Collaborative list module |
| **Photo screensaver** | Family photos when idle | Google Photos API integration |
| **Multi-device sync** | Multiple displays, same data | Web app works everywhere |

### Hardware Options

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| **Old iPad on wall mount** | $50-100 (used) | Touch, good display, runs any web app | Battery management |
| **Raspberry Pi + touchscreen** | $100-150 | Always on, self-hosted | Lower quality display |
| **Amazon Fire tablet** | $50-80 | Cheap, wall-mountable | Limited browser |
| **Dedicated monitor + Pi** | $150-200 | Large display, kitchen-friendly | More setup |

### Display Dashboard Features

```
┌─────────────────────────────────────────────────────────┐
│  ☀️ 72°F Sunny                    Tuesday, Dec 31  9:45 AM │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📅 TODAY                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔵 Dad     │ 10:00 AM - Team standup            │   │
│  │ 🟢 Mom     │ 2:00 PM - Dentist appointment      │   │
│  │ 🟡 Kid 1   │ 4:00 PM - Soccer practice          │   │
│  │ 🟣 Kid 2   │ 3:30 PM - Art class                │   │
│  │ 🟠 Kid 3   │ 10:30 AM - Music time              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  🍽️ DINNER: Chicken stir-fry (30 min) [View Recipe]    │
│                                                         │
│  ✅ CHORES                              ⭐ LEADERBOARD  │
│  ┌──────────────────────┐              ┌────────────┐  │
│  │ Kid 1                │              │ Kid 1: 45  │  │
│  │ ☑️ Make bed          │              │ Kid 2: 38  │  │
│  │ ☐ Empty dishwasher   │              └────────────┘  │
│  │ ☐ Homework           │                              │
│  ├──────────────────────┤                              │
│  │ Kid 2                │                              │
│  │ ☑️ Make bed          │                              │
│  │ ☑️ Feed fish         │                              │
│  │ ☐ Reading (20 min)   │                              │
│  └──────────────────────┘                              │
│                                                         │
│  🛒 GROCERY (5 items)              📦 PACKAGES          │
│  • Milk                            • Amazon (tomorrow)  │
│  • Bananas                         • Target (delivered) │
│  • Bread                                                │
│  [+ Add] [Order on Instacart]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Touch Interactions

- **Tap event** → Show details, edit, delete
- **Tap chore** → Mark complete (with celebration animation!)
- **Tap meal** → Show recipe
- **Swipe left/right** → Navigate days
- **Long press** → Quick add event/chore/grocery item
- **Voice** → "Hey Jarvis, add milk to the grocery list"

### Kiosk Mode Setup

```bash
# Raspberry Pi kiosk setup
# Auto-start Chromium in kiosk mode pointing to Jarvis dashboard

# /etc/xdg/lxsession/LXDE-pi/autostart
@chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble \
  https://jarvis.local/dashboard

# Disable screen blanking
@xset s off
@xset -dpms
@xset s noblank
```

### Dashboard Tech Stack

```
Frontend:
├── React 18
├── TailwindCSS (responsive, touch-friendly)
├── Framer Motion (celebrations, transitions)
├── React Query (real-time updates)
└── PWA (installable, offline-capable)

Backend:
├── Rails API (existing)
├── WebSockets (live updates)
└── Background jobs (sync)
```

### Why Build Our Own?

| Skylight | DIY Jarvis |
|----------|------------|
| $300-630 hardware | $50-150 (reuse old tablet) |
| $79/year subscription | Free forever |
| Limited integrations | Any API you want |
| Their servers | Your data, your control |
| No customization | Fully customizable |
| Google Calendar only (full sync) | Any calendar system |

### Reference: [Skylight Calendar](https://myskylight.com/calendar/), [Skylight Review](https://cybernews.com/reviews/skylight-calendar-review/)

---

*"Just a rather very intelligent system."* — Tony Stark
