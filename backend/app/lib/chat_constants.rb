# frozen_string_literal: true

# Centralized constants for the chat system to eliminate magic strings.
# All pending action names, action types, status codes, and error codes
# should be defined here.
module ChatConstants
  # Pending action states - used in ChatThread.state['pending_action']
  module PendingAction
    # Intent clarification
    CLARIFY_IMAGE_INTENT = 'clarify_image_intent'
    CLARIFY_INTENT = 'clarify_intent'

    # Event creation
    CLARIFY_EVENT_FIELDS = 'clarify_event_fields'
    CONFIRM_EVENT = 'confirm_event'
    SELECT_EVENT_FROM_EXTRACTION = 'select_event_from_extraction'

    # Event update
    CLARIFY_UPDATE_CHANGES = 'clarify_update_changes'
    CLARIFY_UPDATE_TARGET = 'clarify_update_target'
    SELECT_EVENT_FOR_UPDATE = 'select_event_for_update'
    CONFIRM_UPDATE = 'confirm_update'

    # Event delete
    CLARIFY_DELETE_TARGET = 'clarify_delete_target'
    SELECT_EVENT_FOR_DELETE = 'select_event_for_delete'
    CONFIRM_DELETE = 'confirm_delete'

    # Shared event states
    CLARIFY_RECURRING_SCOPE = 'clarify_recurring_scope'

    # Event list
    CLARIFY_LIST_QUERY = 'clarify_list_query'

    # Transaction creation
    CLARIFY_TRANSACTION_FIELDS = 'clarify_transaction_fields'
    CONFIRM_TRANSACTION = 'confirm_transaction'
    SELECT_TRANSACTION_FROM_EXTRACTION = 'select_transaction_from_extraction'

    # Memory creation
    CLARIFY_MEMORY_FIELDS = 'clarify_memory_fields'
    CONFIRM_MEMORY = 'confirm_memory'

    ALL = [
      CLARIFY_IMAGE_INTENT, CLARIFY_INTENT,
      CLARIFY_EVENT_FIELDS, CONFIRM_EVENT, SELECT_EVENT_FROM_EXTRACTION,
      CLARIFY_UPDATE_CHANGES, CLARIFY_UPDATE_TARGET, SELECT_EVENT_FOR_UPDATE, CONFIRM_UPDATE,
      CLARIFY_DELETE_TARGET, SELECT_EVENT_FOR_DELETE, CONFIRM_DELETE,
      CLARIFY_RECURRING_SCOPE, CLARIFY_LIST_QUERY,
      CLARIFY_TRANSACTION_FIELDS, CONFIRM_TRANSACTION, SELECT_TRANSACTION_FROM_EXTRACTION,
      CLARIFY_MEMORY_FIELDS, CONFIRM_MEMORY
    ].freeze
  end

  # Action types for ChatAction logging
  module ActionType
    # Calendar events
    CREATE_CALENDAR_EVENT = 'create_calendar_event'
    UPDATE_CALENDAR_EVENT = 'update_calendar_event'
    DELETE_CALENDAR_EVENT = 'delete_calendar_event'
    SELECT_CALENDAR_EVENT = 'select_calendar_event'
    LIST_EVENTS = 'list_events'

    # Transactions
    CREATE_TRANSACTION = 'create_transaction'

    # Memory
    CREATE_MEMORY = 'create_memory'

    # Errors
    CHAT_ERROR = 'chat_error'
  end

  # Status codes for ChatAction logging
  module Status
    SUCCESS = 'success'
    ERROR = 'error'
    DUPLICATE = 'duplicate'
  end

  # Error codes returned to frontend
  module ErrorCode
    EVENT_NOT_FOUND = 'event_not_found'
    INSUFFICIENT_PERMISSIONS = 'insufficient_permissions'
    MISSING_EVENT_UPDATE_FIELDS = 'missing_event_update_fields'
    DUPLICATE_EVENT = 'duplicate_event'
    DUPLICATE_UPDATE = 'duplicate_update'
    DUPLICATE_DELETE = 'duplicate_delete'
  end

  # Frontend action codes for dispatching refresh events
  module FrontendAction
    CALENDAR_EVENT_CREATED = 'calendar_event_created'
    CALENDAR_EVENT_UPDATED = 'calendar_event_updated'
    CALENDAR_EVENT_DELETED = 'calendar_event_deleted'
    TRANSACTION_CREATED = 'transaction_created'
  end

  # Intent names from Gemini classification
  module Intent
    CREATE_EVENT = 'create_event'
    UPDATE_EVENT = 'update_event'
    DELETE_EVENT = 'delete_event'
    LIST_EVENTS = 'list_events'
    CREATE_TRANSACTION = 'create_transaction'
    CREATE_MEMORY = 'create_memory'
    SEARCH_MEMORY = 'search_memory'
    SEARCH_TRANSACTION = 'search_transaction'
    DIGEST = 'digest'
    HELP = 'help'
    AMBIGUOUS = 'ambiguous'
  end

  # Record status values (for CalendarEvent, Memory, etc.)
  module RecordStatus
    ACTIVE = 'active'
    CANCELLED = 'cancelled'
  end

  # Recurring scope options
  module RecurringScope
    INSTANCE = 'instance'
    SERIES = 'series'
  end
end
