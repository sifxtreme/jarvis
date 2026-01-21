# Adding New Chat Capabilities

This guide explains how to add a new action/capability to the Jarvis chat system. The system uses Gemini AI for intent classification and data extraction, with a flow engine pattern for multi-step interactions.

## Architecture Overview

```
User Message
     ↓
┌─────────────────────────────────────────┐
│         Intent Classification           │
│    (Gemini classifies user intent)      │
└─────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────┐
│           Intent Handler                │
│   (Routes to appropriate flow/handler)  │
└─────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────┐
│         Flow Engine (optional)          │
│  extract → clarify → confirm → execute  │
└─────────────────────────────────────────┘
     ↓
Response to User
```

## Key Files

| File | Purpose |
|------|---------|
| `chat_constants.rb` | All constants (intents, pending actions, etc.) |
| `gemini_client.rb` | Gemini API calls and prompts |
| `chat_helpers/extraction.rb` | Extraction helper methods |
| `chat_flows/*.rb` | Flow classes for create/update/delete patterns |
| `chat_helpers/*_handlers.rb` | Handler methods for each capability |
| `web_chat_message_handler.rb` | Main router and orchestrator |

## Step-by-Step Guide

### 1. Add Constants

**File: `backend/app/lib/chat_constants.rb`**

```ruby
module ChatConstants
  module Intent
    # Add your new intent
    CREATE_REMINDER = 'create_reminder'
  end

  module PendingAction
    # Add pending actions for multi-step flows
    CLARIFY_REMINDER_FIELDS = 'clarify_reminder_fields'
    CONFIRM_REMINDER = 'confirm_reminder'

    # Add to ALL array
    ALL = [
      # ... existing actions ...
      CLARIFY_REMINDER_FIELDS, CONFIRM_REMINDER,
    ]
  end

  module ActionType
    # Add for logging
    CREATE_REMINDER = 'create_reminder'
  end

  module FrontendAction
    # Add if frontend needs to react
    REMINDER_CREATED = 'reminder_created'
  end
end
```

### 2. Update Gemini Intent Classification

**File: `backend/app/lib/gemini_client.rb`**

Add your intent to the `intent_prompt` method:

```ruby
def intent_prompt(text, has_image:, today:, context: nil)
  # ...
  <<~PROMPT
    Return JSON only:
    {
      "intent": "create_event" | "update_event" | ... | "create_reminder",  # Add here
      # ...
    }

    Rules:
    # Add classification rules
    - Use "create_reminder" when the user wants to set a reminder or be notified about something.
  PROMPT
end
```

### 3. Add Extraction Prompt (if needed)

**File: `backend/app/lib/gemini_client.rb`**

```ruby
def extract_reminder_from_text(text, context: nil)
  parts = [{ text: reminder_prompt(text, context: context) }]
  response = make_request(parts: parts, model: DEFAULT_EXTRACT_MODEL)
  parse_json_response(response)
end

private

def reminder_prompt(text, context: nil)
  context_block = format_context_block(context)
  <<~PROMPT
    Today is #{today_in_timezone} (Timezone: #{timezone_label}).

    #{context_block}Extract reminder details from the text. Return JSON:
    {
      "message": "What to remind about",
      "remind_at": "YYYY-MM-DD HH:MM",
      "confidence": "low|medium|high"
    }

    If no reminder details found:
    {
      "error": "no_reminder_found",
      "message": "What would you like to be reminded about?"
    }

    Text:
    "#{text}"
  PROMPT
end
```

### 4. Add Extraction Helper

**File: `backend/app/lib/chat_helpers/extraction.rb`**

```ruby
def extract_reminder_from_text
  result = gemini.extract_reminder_from_text(@text, context: recent_context_text)
  log_ai_result(result, request_kind: 'reminder', model: gemini_extract_model)
  result
rescue StandardError => e
  { text: "Reminder extraction error: #{e.message}" }
end
```

### 5. Create Flow Class (for multi-step interactions)

**File: `backend/app/lib/chat_flows/reminder.rb`**

```ruby
require 'chat_constants'

module ChatFlows
  class Reminder < Base
    def kind
      :reminder
    end

    def intent
      ChatConstants::Intent::CREATE_REMINDER
    end

    def plural_label
      'reminders'
    end

    def singular_label
      'reminder'
    end

    def payload_key
      'reminder'
    end

    def extract(_image_message_id: nil)
      handler.extract_reminder_from_text
    end

    def missing_fields(payload)
      missing = []
      missing << 'message' if payload['message'].to_s.strip.empty?
      missing << 'remind_at' if payload['remind_at'].to_s.strip.empty?
      missing
    end

    def error_missing_fields
      ['message', 'remind_at']
    end

    def error_fallback
      'What should I remind you about and when?'
    end

    def confirm_prompt(payload, stage: :initial)
      time = payload['remind_at']
      message = payload['message']
      "I'll remind you: \"#{message}\" at #{time}. Sound good?"
    end

    def execute(payload)
      handler.create_reminder(payload)
    end

    def clarify_action
      ChatConstants::PendingAction::CLARIFY_REMINDER_FIELDS
    end

    def confirm_action
      ChatConstants::PendingAction::CONFIRM_REMINDER
    end
  end
end
```

### 6. Add Handler Methods

**File: `backend/app/lib/chat_helpers/reminder_handlers.rb`** (new file)

```ruby
module ChatHelpers
  module ReminderHandlers
    def handle_create_reminder
      flow_engine.handle_create(:reminder)
    end

    def create_reminder(payload)
      reminder = Reminder.create!(
        user: @user,
        message: payload['message'],
        remind_at: parse_datetime(payload['remind_at']),
        status: 'pending'
      )

      log_action(
        @message,
        reminder_id: reminder.id,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::CREATE_REMINDER,
        metadata: { reminder: payload }
      )

      build_response(
        "Reminder set! I'll notify you at #{reminder.remind_at.strftime('%B %d at %I:%M %p')}.",
        action: ChatConstants::FrontendAction::REMINDER_CREATED
      )
    rescue StandardError => e
      build_response("Failed to create reminder: #{e.message}")
    end
  end
end
```

### 7. Register the Flow

**File: `backend/app/lib/chat_flow_engine.rb`**

```ruby
require 'chat_flows/reminder'

class ChatFlowEngine
  FLOWS = {
    event: ChatFlows::Event,
    transaction: ChatFlows::Transaction,
    memory: ChatFlows::Memory,
    reminder: ChatFlows::Reminder,  # Add here
  }.freeze

  # ...
end
```

### 8. Include Handler Module

**File: `backend/app/lib/web_chat_message_handler.rb`**

```ruby
class WebChatMessageHandler
  include ChatHelpers::ReminderHandlers  # Add here

  # ...
end
```

### 9. Add Intent Routing

**File: `backend/app/lib/web_chat_message_handler.rb`**

In the `handle_new_message` method:

```ruby
case intent_name
when ChatConstants::Intent::CREATE_EVENT
  handle_create_event
# ... other cases ...
when ChatConstants::Intent::CREATE_REMINDER  # Add here
  handle_create_reminder
else
  handle_fallback
end
```

### 10. Add Pending Action Handling

**File: `backend/app/lib/web_chat_message_handler.rb`**

In the `handle_pending_action` method:

```ruby
case action
# ... existing cases ...
when ChatConstants::PendingAction::CLARIFY_REMINDER_FIELDS
  return handle_reminder_correction(payload)
when ChatConstants::PendingAction::CONFIRM_REMINDER
  return handle_reminder_confirmation(payload)
end
```

### 11. Add Confirmation Handlers

**File: `backend/app/lib/chat_helpers/confirmations.rb`**

```ruby
def handle_reminder_correction(payload)
  flow_engine.handle_correction(:reminder, payload)
end

def handle_reminder_confirmation(payload)
  flow_engine.handle_confirmation(:reminder, payload)
end
```

## Testing Your New Capability

1. **Test intent classification:**
   ```
   User: "Remind me to call mom tomorrow at 3pm"
   Expected: Intent = create_reminder, confidence = high
   ```

2. **Test extraction:**
   ```
   User: "Remind me to call mom tomorrow at 3pm"
   Expected: { message: "call mom", remind_at: "2026-01-22 15:00" }
   ```

3. **Test missing fields flow:**
   ```
   User: "Set a reminder"
   Expected: Asks for message and time
   ```

4. **Test confirmation flow:**
   ```
   User: "Remind me to buy milk"
   Expected: Asks when to remind
   User: "Tomorrow morning"
   Expected: Confirms the reminder details
   ```

## Flow Engine Pattern

The flow engine (`ChatFlowEngine`) provides a standard pattern for capabilities that need:
- **Extraction** - Parse user input into structured data
- **Clarification** - Ask for missing required fields
- **Confirmation** - Verify before executing (for medium confidence)
- **Execution** - Perform the action

To use the flow engine, your flow class must inherit from `ChatFlows::Base` and implement the required methods.

## Without Flow Engine (Simple Capabilities)

For simple capabilities that don't need multi-step interactions:

```ruby
# In handler
def handle_simple_action
  # Direct extraction and execution
  result = extract_data_from_text
  return build_response(result[:error]) if result[:error]

  execute_action(result)
  build_response("Done!")
end
```

## Checklist

- [ ] Constants added to `chat_constants.rb`
- [ ] Intent added to Gemini prompt
- [ ] Extraction prompt created (if needed)
- [ ] Extraction helper method added
- [ ] Flow class created (if multi-step)
- [ ] Flow registered in `ChatFlowEngine::FLOWS`
- [ ] Handler module created
- [ ] Handler module included in `WebChatMessageHandler`
- [ ] Intent routing added
- [ ] Pending action handling added
- [ ] Confirmation handlers added
- [ ] Tests written

## Tips

1. **Lean on Gemini** - Use AI for understanding, not regex/string matching
2. **Use constants** - Never hardcode strings for intents, actions, or statuses
3. **Follow existing patterns** - Look at `ChatFlows::Event` as a reference
4. **Log everything** - Use `log_action` for audit trail
5. **Handle errors gracefully** - Always have fallback responses
6. **Keep prompts focused** - One task per prompt for better accuracy
