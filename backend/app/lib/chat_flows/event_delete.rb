# frozen_string_literal: true

require 'chat_constants'

module ChatFlows
  class EventDelete < Base
    def kind
      :event_delete
    end

    def intent
      ChatConstants::Intent::DELETE_EVENT
    end

    def plural_label
      'events'
    end

    def singular_label
      'event'
    end

    def payload_key
      'event_id'
    end

    # Main entry point for delete flow
    def handle_delete
      query = handler.send(:extract_event_query)
      return query if query.is_a?(Hash) && query[:text]

      data = query[:event]

      if data['error']
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'delete_event_target',
            missing_fields: ['title', 'date'],
            extracted: {},
            fallback: "Which event should I delete? Please share the title and date."
          )
        )
      end

      find_and_delete(data)
    end

    def handle_target_clarification(_payload)
      query = handler.send(:extract_event_query)
      return query if query.is_a?(Hash) && query[:text]

      data = query[:event]

      if data['error']
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'delete_event_target',
            missing_fields: ['title', 'date'],
            extracted: {},
            fallback: "I still need the event title or date."
          )
        )
      end

      find_and_delete(data, clear_state: true)
    end

    def handle_selection(payload)
      candidates = (payload['candidates'] || []).map { |entry| handler.send(:symbolize_candidate, entry) }.compact
      selected = handler.send(:pick_candidate, candidates)

      unless selected
        return handler.build_response("Reply with the number of the event you want.")
      end

      event_record = selected[:event]

      handler.send(:log_action,
        handler.message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::SELECT_CALENDAR_EVENT,
        metadata: {
          selection_kind: 'delete',
          candidates: payload['candidates'],
          selected_event: handler.send(:event_snapshot, event_record)
        }
      )

      handler.send(:clear_thread_state)
      confirm_or_delete(event_record)
    end

    def handle_recurring_scope(payload)
      scope = handler.send(:resolve_recurring_scope, handler.text)[:scope]
      unless scope
        return handler.build_response("Reply \"this\" to delete only this event or \"all\" for the whole series.")
      end

      event_record = CalendarEvent.find_by(id: payload['event_id'])
      unless event_record
        handler.send(:clear_thread_state)
        return handler.build_response("I couldn't find that event anymore.", error_code: ChatConstants::ErrorCode::EVENT_NOT_FOUND)
      end

      handler.send(:clear_thread_state)
      handler.send(:delete_event, event_record, scope: scope)
    end

    def handle_confirmation(payload)
      event_id = payload['event_id']
      snapshot = payload['snapshot']
      scope = payload['recurring_scope'] || handler.send(:resolve_recurring_scope, handler.text)[:scope]
      event_record = CalendarEvent.find_by(id: event_id)

      unless event_record
        calendar_id = snapshot.is_a?(Hash) ? (snapshot['calendar_id'] || snapshot[:calendar_id]) : nil
        handler.send(:log_action,
          handler.message,
          calendar_event_id: nil,
          calendar_id: calendar_id,
          status: ChatConstants::Status::ERROR,
          action_type: ChatConstants::ActionType::DELETE_CALENDAR_EVENT,
          metadata: { error_code: ChatConstants::ErrorCode::EVENT_NOT_FOUND, event_id: event_id, snapshot: snapshot }
        )
        return handler.build_response("I couldn't find that event anymore.", error_code: ChatConstants::ErrorCode::EVENT_NOT_FOUND)
      end

      if handler.send(:affirmative?)
        handler.send(:clear_thread_state)
        return handler.send(:delete_event, event_record, scope: scope)
      end

      handler.send(:clear_thread_state)
      handler.build_response("Okay, I won't delete it.")
    end

    private

    def find_and_delete(target, clear_state: false)
      candidates = handler.send(:find_event_candidates_with_fallback, target)

      if candidates.empty?
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_DELETE_TARGET,
          {}
        )
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'delete_event_target',
            missing_fields: ['title', 'date'],
            extracted: {},
            fallback: "I couldn't find that event. Can you share the title and date?"
          )
        )
      end

      handle_candidates(candidates, clear_state: clear_state)
    end

    def handle_candidates(candidates, clear_state: false)
      if candidates.length > 1
        if (auto_pick = handler.send(:auto_pick_candidate, candidates))
          handler.send(:clear_thread_state) if clear_state
          return confirm_or_delete(auto_pick[:event])
        end
        payload = { 'candidates' => handler.send(:serialize_candidates, candidates) }
        handler.send(:set_pending_action, ChatConstants::PendingAction::SELECT_EVENT_FOR_DELETE, payload)
        return handler.build_response("Which event should I delete?\n#{handler.send(:format_candidates, candidates)}")
      end

      handler.send(:clear_thread_state) if clear_state
      confirm_or_delete(candidates.first[:event])
    end

    def confirm_or_delete(event_record)
      scope = handler.send(:resolve_recurring_scope, handler.text)[:scope]

      if handler.send(:recurring_event?, event_record) && scope.nil?
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_RECURRING_SCOPE,
          {
            'event_id' => event_record.id,
            'snapshot' => handler.send(:event_snapshot, event_record),
            'action' => 'delete'
          }
        )
        return handler.build_response("This event repeats. Delete just this event or the whole series? Reply \"this\" or \"all\".")
      end

      handler.send(:set_pending_action,
        ChatConstants::PendingAction::CONFIRM_DELETE,
        {
          'event_id' => event_record.id,
          'snapshot' => handler.send(:event_snapshot, event_record),
          'recurring_scope' => scope
        }
      )
      handler.build_response("Delete this event?\n#{handler.send(:format_event_record, event_record)}")
    end
  end
end
