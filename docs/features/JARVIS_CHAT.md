# Feature: Jarvis Chat
Date: 2026-01-02

> Your AI assistant for life's recurring tasks, starting with screenshots → calendar events

---

## Status (Current vs Future)

- Implemented: Slack + web chat flows using Gemini for intent + extraction.
- Future/UX vision: Full chat UI with rich previews and edit/confirm flows (mockups below).

## Reliability + Observability (Current)

- Idempotency for create/update/delete within a short window to avoid duplicate actions.
- Event selection snapshots are stored at selection time to prevent drift before confirmation.
- Post-update verification re-fetches the event and flags partial updates.
- Structured error codes are returned and logged for calendar actions.
- Gemini + Google Calendar requests/responses are logged with correlation IDs for traceability.

## Product Vision

### Why Chat?

A form could extract events from screenshots. But chat offers something more:

1. **Conversational Corrections** — "Actually, make it 4pm not 3pm"
2. **Context Accumulation** — "Add another event from this flyer" (knows which flyer)
3. **Multi-Step Workflows** — "Create the event and remind me to buy tickets"
4. **Natural Interface** — Same UX pattern as texting a friend

Jarvis isn't just a tool—it's your digital butler. The chat metaphor sets the stage for future capabilities: email triage, grocery lists, family coordination.

### The First Capability: Screenshot → Calendar

The most common friction point: You see an event (school flyer, text from a friend, Instagram post) and need to get it into your calendar. Currently:

1. Open Google Calendar
2. Tap "Create Event"
3. Manually type title, date, time, location
4. Hope you didn't make a typo

With Jarvis:

1. Screenshot the event
2. Send to Jarvis
3. Confirm or adjust
4. Done

**Time saved: 2-3 minutes per event × hundreds of events/year**

---

## User Experience

### Primary Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Jarvis                                              [Settings] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │     Drop an image here, or paste from clipboard          │   │
│  │                                                          │   │
│  │                    📎 or click to browse                 │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  You can also just type a message...                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐ [Send]   │
│  │ Type a message...                                 │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### After Sending a Screenshot

```
┌─────────────────────────────────────────────────────────────────┐
│  Jarvis                                              [Settings] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                                          ┌───────────────────┐  │
│                                          │ [Screenshot image]│  │
│                                          │                   │  │
│                                          └───────────────────┘  │
│                                                          12:34  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ I found an event in that image:                          │  │
│  │                                                          │  │
│  │  ╭──────────────────────────────────────────────────╮   │  │
│  │  │ 📅 School Science Fair                           │   │  │
│  │  │                                                   │   │  │
│  │  │ 📆 Friday, January 24, 2025                      │   │  │
│  │  │ 🕐 6:00 PM - 8:00 PM                             │   │  │
│  │  │ 📍 Lincoln Elementary School Gym                 │   │  │
│  │  │                                                   │   │  │
│  │  │ Students present their science projects.         │   │  │
│  │  │ Refreshments will be served.                     │   │  │
│  │  │                                                   │   │  │
│  │  │        [Add to Calendar]    [Edit First]         │   │  │
│  │  ╰──────────────────────────────────────────────────╯   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                          12:34  │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐ [Send]   │
│  │ Type a message...                                 │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Correction Flow

```
User: "Make it 7pm instead"

Jarvis:
┌──────────────────────────────────────────────────────────────┐
│ Got it! I've updated the time:                               │
│                                                              │
│  ╭──────────────────────────────────────────────────╮       │
│  │ 📅 School Science Fair                           │       │
│  │ 📆 Friday, January 24, 2025                      │       │
│  │ 🕐 7:00 PM - 9:00 PM  ← Updated                  │       │
│  │ 📍 Lincoln Elementary School Gym                 │       │
│  │                                                   │       │
│  │        [Add to Calendar]    [Edit First]         │       │
│  ╰──────────────────────────────────────────────────╯       │
└──────────────────────────────────────────────────────────────┘
```

### Success State

```
Jarvis:
┌──────────────────────────────────────────────────────────────┐
│ ✅ Added to your calendar!                                   │
│                                                              │
│ "School Science Fair" on Friday, Jan 24 at 7:00 PM          │
│                                                              │
│ [View in Google Calendar ↗]                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Image Input Methods

### Desktop

| Method | Implementation |
|--------|---------------|
| **Drag & Drop** | `onDrop` handler on drop zone |
| **Paste** | Global `onPaste` listener for `image/*` |
| **Click to Browse** | Hidden `<input type="file" accept="image/*">` |

### Mobile

| Method | Implementation |
|--------|---------------|
| **Camera** | `<input type="file" accept="image/*" capture="environment">` |
| **Photo Library** | Same input without `capture` |
| **Paste** | Works on iOS Safari, Android Chrome |

### Technical Implementation

```tsx
// components/chat/ImageDropZone.tsx

export function ImageDropZone({ onImageSelect }: { onImageSelect: (base64: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle paste anywhere on page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) processFile(file);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = async (file: File) => {
    // Resize if too large (max 1568px for optimal Claude/Gemini processing)
    const resized = await resizeImage(file, 1568);
    const base64 = await fileToBase64(resized);
    onImageSelect(base64);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      processFile(file);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />

      <div className="space-y-2">
        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop an image here, or paste from clipboard
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse
        </p>
      </div>
    </div>
  );
}
```

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                                                                  │
│  ChatPage.tsx                                                   │
│  ├── ChatMessages (message history)                             │
│  ├── EventCard (extracted event display)                        │
│  ├── ImageDropZone (drag/drop/paste)                            │
│  └── ChatInput (text input + send)                              │
│                                                                  │
│  State: messages[], pendingEvent, isLoading                     │
│                                                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                     POST /chat/message
                     POST /chat/confirm_event
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│                                                                  │
│  ChatController                                                 │
│  ├── message: Receives text/image, routes to appropriate handler│
│  └── confirm_event: Creates Google Calendar event               │
│                                                                  │
│  GeminiVision (lib/)                                            │
│  └── extract_event: Image → structured event data               │
│                                                                  │
│  GoogleCalendar (lib/)                                          │
│  └── create_event: Creates event via Google Calendar API        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │   External APIs   │
                    ├───────────────────┤
                    │ • Gemini 3 Flash  │
                    │ • Google Calendar │
                    └───────────────────┘
```

### Why Not SSE?

Rails 5.2 supports SSE via `ActionController::Live`, but:

| Concern | Impact |
|---------|--------|
| **Thread consumption** | Each SSE connection ties up a Puma thread |
| **Browser limits** | Max 6 concurrent SSE connections (HTTP/1.1) |
| **Complexity** | Need careful error handling, reconnection logic |
| **Your use case** | Single user, occasional requests, 2-3 second response times |

**Recommendation:** Start with synchronous request/response. The Gemini API call takes ~2-3 seconds. A loading state is perfectly acceptable. Add SSE later only if the UX feels sluggish.

### API Design

#### `POST /chat/message`

**Request:**
```json
{
  "type": "image",
  "content": "base64_encoded_image_data",
  "mime_type": "image/png",
  "context": {
    "pending_event": { ... }  // If user is correcting a previous extraction
  }
}
```

or

```json
{
  "type": "text",
  "content": "Make it 7pm instead",
  "context": {
    "pending_event": {
      "title": "School Science Fair",
      "date": "2025-01-24",
      "start_time": "18:00",
      "end_time": "20:00",
      "location": "Lincoln Elementary School Gym"
    }
  }
}
```

**Response:**
```json
{
  "type": "event_extracted",
  "message": "I found an event in that image:",
  "event": {
    "title": "School Science Fair",
    "date": "2025-01-24",
    "start_time": "18:00",
    "end_time": "20:00",
    "location": "Lincoln Elementary School Gym",
    "description": "Students present their science projects. Refreshments will be served.",
    "confidence": "high"
  },
  "needs_confirmation": true
}
```

or (for corrections)

```json
{
  "type": "event_updated",
  "message": "Got it! I've updated the time:",
  "event": {
    "title": "School Science Fair",
    "date": "2025-01-24",
    "start_time": "19:00",
    "end_time": "21:00",
    "location": "Lincoln Elementary School Gym",
    "description": "Students present their science projects."
  },
  "changes": ["start_time", "end_time"],
  "needs_confirmation": true
}
```

#### `POST /chat/confirm_event`

**Request:**
```json
{
  "event": {
    "title": "School Science Fair",
    "date": "2025-01-24",
    "start_time": "19:00",
    "end_time": "21:00",
    "location": "Lincoln Elementary School Gym",
    "description": "Students present their science projects."
  },
  "calendar_id": "primary"
}
```

**Response:**
```json
{
  "type": "event_created",
  "message": "Added to your calendar!",
  "event_id": "abc123xyz",
  "event_link": "https://calendar.google.com/calendar/event?eid=abc123xyz"
}
```

---

## Backend Implementation

### Gemini Vision Service

```ruby
# app/lib/gemini_vision.rb
require 'net/http'
require 'json'

class GeminiVision
  API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

  def initialize
    @api_key = ENV.fetch('GEMINI_API_KEY')
  end

  def extract_event(image_base64, mime_type: 'image/png')
    response = make_request(
      contents: [{
        parts: [
          { inline_data: { mime_type: mime_type, data: image_base64 } },
          { text: EXTRACTION_PROMPT }
        ]
      }],
      generation_config: {
        response_mime_type: "application/json"
      }
    )

    text = response.dig('candidates', 0, 'content', 'parts', 0, 'text')
    JSON.parse(text)
  rescue JSON::ParserError => e
    Rails.logger.error "[GeminiVision] Failed to parse response: #{e.message}"
    { error: "Could not parse event details" }
  end

  def apply_correction(event, user_message)
    response = make_request(
      contents: [{
        parts: [{
          text: <<~PROMPT
            Current event details:
            #{event.to_json}

            User correction: "#{user_message}"

            Apply the user's correction to the event. Return the updated event as JSON with the same structure.
            Only change fields that the user explicitly mentioned.
          PROMPT
        }]
      }],
      generation_config: {
        response_mime_type: "application/json"
      }
    )

    text = response.dig('candidates', 0, 'content', 'parts', 0, 'text')
    JSON.parse(text)
  rescue JSON::ParserError => e
    Rails.logger.error "[GeminiVision] Failed to parse correction: #{e.message}"
    event  # Return original if parsing fails
  end

  private

  def make_request(body)
    uri = URI("#{API_URL}?key=#{@api_key}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.read_timeout = 30

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request.body = body.to_json

    response = http.request(request)

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "[GeminiVision] API error: #{response.code} - #{response.body}"
      raise "Gemini API error: #{response.code}"
    end

    JSON.parse(response.body)
  end

  EXTRACTION_PROMPT = <<~PROMPT
    Extract event details from this image. Look for:
    - Event title/name
    - Date (in any format)
    - Start time
    - End time (if shown, otherwise estimate based on event type)
    - Location/venue
    - Any description or additional details

    Return ONLY valid JSON in this exact format:
    {
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM" (24-hour format, or null if not found),
      "end_time": "HH:MM" (24-hour format, or null if not found),
      "location": "Venue name and/or address, or null if not found",
      "description": "Any additional relevant details",
      "confidence": "high" if date and time are clearly visible, "medium" if some guessing required, "low" if very uncertain
    }

    If this image does not contain event information, return:
    {
      "error": "no_event_found",
      "message": "I couldn't find event details in this image. Try sending a clearer image of an event flyer, invitation, or text message."
    }
  PROMPT
end
```

### Google Calendar Service

```ruby
# app/lib/google_calendar.rb
require 'signet/oauth_2/client'
require 'google/apis/calendar_v3'

class GoogleCalendar
  class CalendarError < StandardError; end

  def initialize
    @client = build_oauth_client
    @service = Google::Apis::CalendarV3::CalendarService.new
    @service.authorization = @client
  end

  def create_event(title:, date:, start_time:, end_time: nil, location: nil, description: nil, calendar_id: 'primary')
    # Parse date and times
    start_datetime = parse_datetime(date, start_time)
    end_datetime = end_time ? parse_datetime(date, end_time) : start_datetime + 1.hour

    event = Google::Apis::CalendarV3::Event.new(
      summary: title,
      location: location,
      description: description,
      start: Google::Apis::CalendarV3::EventDateTime.new(
        date_time: start_datetime.iso8601,
        time_zone: time_zone
      ),
      end: Google::Apis::CalendarV3::EventDateTime.new(
        date_time: end_datetime.iso8601,
        time_zone: time_zone
      )
    )

    result = @service.insert_event(calendar_id, event)

    {
      id: result.id,
      link: result.html_link,
      title: result.summary,
      start: result.start.date_time
    }
  rescue Google::Apis::Error => e
    Rails.logger.error "[GoogleCalendar] API error: #{e.message}"
    raise CalendarError, "Failed to create calendar event: #{e.message}"
  end

  def list_calendars
    result = @service.list_calendar_lists
    result.items.map { |cal| { id: cal.id, name: cal.summary, primary: cal.primary } }
  end

  private

  def build_oauth_client
    client = Signet::OAuth2::Client.new(
      client_id: ENV.fetch('GOOGLE_CLIENT_ID'),
      client_secret: ENV.fetch('GOOGLE_CLIENT_SECRET'),
      token_credential_uri: 'https://oauth2.googleapis.com/token',
      refresh_token: ENV.fetch('GOOGLE_REFRESH_TOKEN')
    )
    client.fetch_access_token!
    client
  end

  def parse_datetime(date_str, time_str)
    Time.zone.parse("#{date_str} #{time_str}")
  end

  def time_zone
    ENV.fetch('JARVIS_TIMEZONE', 'America/New_York')
  end
end
```

### Chat Controller

```ruby
# app/controllers/chat_controller.rb

class ChatController < ApplicationController
  def message
    data = JSON.parse(request.body.read)

    case data['type']
    when 'image'
      handle_image_message(data)
    when 'text'
      handle_text_message(data)
    else
      render json: { error: "Unknown message type" }, status: :bad_request
    end
  rescue StandardError => e
    Rails.logger.error "[Chat] Error: #{e.message}"
    render json: {
      type: 'error',
      message: "Sorry, something went wrong. Please try again."
    }, status: :internal_server_error
  end

  def confirm_event
    data = JSON.parse(request.body.read)
    event_data = data['event']

    calendar = GoogleCalendar.new
    result = calendar.create_event(
      title: event_data['title'],
      date: event_data['date'],
      start_time: event_data['start_time'],
      end_time: event_data['end_time'],
      location: event_data['location'],
      description: event_data['description'],
      calendar_id: data['calendar_id'] || 'primary'
    )

    render json: {
      type: 'event_created',
      message: "Added to your calendar!",
      event_id: result[:id],
      event_link: result[:link]
    }
  rescue GoogleCalendar::CalendarError => e
    render json: {
      type: 'error',
      message: "Couldn't create the calendar event: #{e.message}"
    }, status: :unprocessable_entity
  end

  private

  def handle_image_message(data)
    gemini = GeminiVision.new
    result = gemini.extract_event(data['content'], mime_type: data['mime_type'] || 'image/png')

    if result['error']
      render json: {
        type: 'no_event',
        message: result['message'] || "I couldn't find event details in that image."
      }
    else
      render json: {
        type: 'event_extracted',
        message: "I found an event in that image:",
        event: result,
        needs_confirmation: true
      }
    end
  end

  def handle_text_message(data)
    context = data['context'] || {}
    pending_event = context['pending_event']

    if pending_event.present?
      # User is correcting a previous extraction
      gemini = GeminiVision.new
      updated_event = gemini.apply_correction(pending_event, data['content'])

      render json: {
        type: 'event_updated',
        message: "Got it! I've updated the event:",
        event: updated_event,
        needs_confirmation: true
      }
    else
      # No context, just a text message
      render json: {
        type: 'text_response',
        message: "I can help you create calendar events from screenshots. Just paste or drop an image and I'll extract the details!"
      }
    end
  end
end
```

### Routes

```ruby
# config/routes.rb (add)
post 'chat/message', to: 'chat#message'
post 'chat/confirm_event', to: 'chat#confirm_event'
```

---

## Frontend Implementation

### Page Structure

```
client/src/
├── pages/
│   └── ChatPage.tsx              # Main chat page
├── components/
│   └── chat/
│       ├── ChatContainer.tsx      # Orchestrates chat UI
│       ├── ChatMessages.tsx       # Message list (scrollable)
│       ├── ChatMessage.tsx        # Single message bubble
│       ├── ChatInput.tsx          # Text input + send button
│       ├── ImageDropZone.tsx      # Drag/drop/paste area
│       └── EventCard.tsx          # Extracted event with actions
└── lib/
    └── chatApi.ts                 # API calls
```

### State Management

```tsx
// pages/ChatPage.tsx

interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'image' | 'event' | 'event_created';
  content: string;
  imageData?: string;
  event?: ExtractedEvent;
  eventLink?: string;
  timestamp: Date;
}

interface ExtractedEvent {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingEvent, setPendingEvent] = useState<ExtractedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageSelect = async (base64: string) => {
    // Add user message with image
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'image',
      content: '',
      imageData: base64,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatApi.sendImage(base64);

      if (response.type === 'event_extracted') {
        setPendingEvent(response.event);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: response.type === 'event_extracted' ? 'event' : 'text',
        content: response.message,
        event: response.event,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSend = async (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatApi.sendText(text, { pending_event: pendingEvent });

      if (response.type === 'event_updated') {
        setPendingEvent(response.event);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: response.type === 'event_updated' ? 'event' : 'text',
        content: response.message,
        event: response.event,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEvent = async () => {
    if (!pendingEvent) return;

    setIsLoading(true);
    try {
      const response = await chatApi.confirmEvent(pendingEvent);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'event_created',
        content: response.message,
        eventLink: response.event_link,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setPendingEvent(null);
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b p-4">
        <h1 className="text-lg font-semibold">Jarvis</h1>
      </header>

      <ChatMessages messages={messages} isLoading={isLoading} />

      {pendingEvent && (
        <EventCard
          event={pendingEvent}
          onConfirm={handleConfirmEvent}
          onEdit={() => {/* Focus input for correction */}}
        />
      )}

      <div className="border-t p-4 space-y-4">
        {messages.length === 0 && (
          <ImageDropZone onImageSelect={handleImageSelect} />
        )}
        <ChatInput
          onSend={handleTextSend}
          onImageSelect={handleImageSelect}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
```

### EventCard Component

```tsx
// components/chat/EventCard.tsx

interface EventCardProps {
  event: ExtractedEvent;
  onConfirm: () => void;
  onEdit: () => void;
}

export function EventCard({ event, onConfirm, onEdit }: EventCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <Card className="mx-4 mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <CalendarIcon className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">{event.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDaysIcon className="h-4 w-4" />
          <span>{formatDate(event.date)}</span>
        </div>

        {event.start_time && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClockIcon className="h-4 w-4" />
            <span>
              {formatTime(event.start_time)}
              {event.end_time && ` - ${formatTime(event.end_time)}`}
            </span>
          </div>
        )}

        {event.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="h-4 w-4" />
            <span>{event.location}</span>
          </div>
        )}

        {event.description && (
          <p className="text-sm text-muted-foreground border-t pt-2">
            {event.description}
          </p>
        )}

        {event.confidence !== 'high' && (
          <p className="text-xs text-amber-600">
            ⚠️ Some details were unclear. Please verify before adding.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={onConfirm} className="flex-1">
            Add to Calendar
          </Button>
          <Button variant="outline" onClick={onEdit}>
            Edit First
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Authentication Setup (One-Time)

### 1. Gemini API Key (~2 minutes)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy key → Add to `.env`: `GEMINI_API_KEY=your_key`

Free tier includes 15 requests/minute, 1M tokens/day. More than enough for personal use.

### 2. Google Calendar OAuth (~15 minutes)

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project (e.g., "Jarvis")
3. Enable "Google Calendar API" in APIs & Services

#### Step 2: Configure OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. Choose "External" user type
3. Fill in app name ("Jarvis"), support email
4. Add scope: `https://www.googleapis.com/auth/calendar`
5. Add yourself as test user
6. **Important:** Publish the app (click "Publish App") to avoid 7-day token expiration

#### Step 3: Create OAuth Credentials

1. Go to APIs & Services → Credentials
2. Create Credentials → OAuth client ID
3. Application type: "Web application"
4. Add authorized redirect URI: `https://developers.google.com/oauthplayground`
5. Note the Client ID and Client Secret

#### Step 4: Get Refresh Token

1. Go to [OAuth Playground](https://developers.google.com/oauthplayground)
2. Click gear icon (Settings) → Check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In left panel, find "Calendar API v3" → Select `https://www.googleapis.com/auth/calendar`
5. Click "Authorize APIs" → Sign in with your Google account
6. Click "Exchange authorization code for tokens"
7. Copy the **Refresh Token**

#### Step 5: Add to Environment

```bash
# .env or jarvis.env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
JARVIS_TIMEZONE=America/New_York
```

---

## Implementation Plan

### Phase 1: Backend Foundation (~3 hours)

| Task | Time |
|------|------|
| Add google-apis-calendar_v3 and signet gems | 10 min |
| Create GeminiVision service | 45 min |
| Create GoogleCalendar service | 45 min |
| Create ChatController | 45 min |
| Add routes | 5 min |
| Test with curl | 30 min |

### Phase 2: Frontend Foundation (~2 hours)

| Task | Time |
|------|------|
| Create ChatPage.tsx with basic layout | 30 min |
| Create chatApi.ts | 20 min |
| Add React Query hooks | 20 min |
| Add route and navigation | 10 min |
| Basic message display | 40 min |

### Phase 3: Image Handling (~2 hours)

| Task | Time |
|------|------|
| Create ImageDropZone with drag/drop | 45 min |
| Add paste listener | 20 min |
| Image resizing utility | 20 min |
| Mobile camera input | 15 min |
| Loading states | 20 min |

### Phase 4: Event Cards & Confirmation (~1.5 hours)

| Task | Time |
|------|------|
| Create EventCard component | 45 min |
| Confirmation flow | 30 min |
| Success state with calendar link | 15 min |

### Phase 5: Corrections & Polish (~1.5 hours)

| Task | Time |
|------|------|
| Text correction flow | 30 min |
| Error handling | 20 min |
| Empty state | 15 min |
| Mobile responsiveness | 25 min |

**Total Estimate: ~10 hours (1.5-2 days)**

---

## Future Enhancements

### Near-Term
- **Multiple calendars** — Let user choose which calendar to add to
- **Recurring events** — "Make this weekly"
- **Time zone handling** — Detect from image or ask user
- **Edit before confirm** — Inline editing of extracted fields

### Medium-Term
- **Message history** — Persist chat history (localStorage or database)
- **Email forwarding** — Forward emails to Jarvis, extract events
- **SMS/iMessage integration** — Via Shortcuts app on iOS

### Long-Term (FUTURE_VISION.md)
- **Email triage** — "What needs my attention today?"
- **Grocery lists** — "Add milk to my shopping list"
- **Family coordination** — "What's on the kids' schedule this week?"
- **Daily briefings** — Morning summary of calendar, weather, tasks

---

## Open Questions

1. **Calendar selection** — Should users pick calendar per-event, or set a default?
   - Recommendation: Default to "primary", add dropdown for power users

2. **Confidence thresholds** — Auto-create for high confidence, or always confirm?
   - Recommendation: Always confirm initially, add "trust mode" later

3. **Message persistence** — Store chat history?
   - Recommendation: Start with session-only (localStorage), add DB later if needed

4. **Mobile-first or desktop-first?**
   - Recommendation: Mobile-first (screenshot capture is inherently mobile)

5. **Branding** — "Jarvis Chat" or just integrate into main app?
   - Recommendation: Separate page for now, integrate into sidebar later
