# frozen_string_literal: true

require 'chat_constants'

module ChatFlows
  class EventUpdate < Base
    def kind
      :event_update
    end

    def intent
      ChatConstants::Intent::UPDATE_EVENT
    end

    def plural_label
      'events'
    end

    def singular_label
      'event'
    end

    def payload_key
      'changes'
    end

    # Extract update intent: changes + target
    def extract(_image_message_id: nil)
      result = handler.send(:gemini).extract_event_update_from_text(
        handler.text,
        context: handler.send(:recent_context_text)
      )
      handler.send(:log_ai_result, result, request_kind: 'event_update', model: handler.send(:gemini_intent_model))
      result
    end

    def parse_extraction(result)
      data = result[:event] || {}
      changes = (data['changes'] || {}).compact
      changes['confidence'] = data['confidence'] if data['confidence']

      duration_minutes = handler.send(:parse_duration_minutes, handler.text)
      changes['duration_minutes'] = duration_minutes if duration_minutes
      changes['recurrence'] = handler.send(:normalize_recurrence, changes['recurrence'])
      changes['recurrence_clear'] = true if changes['recurrence_clear']

      target = (data['target'] || {}).compact

      { changes: changes, target: target }
    end

    def missing_changes?(changes)
      changes.except('confidence').empty?
    end

    def missing_target?(target)
      target.empty?
    end

    # Main entry point for update flow
    def handle_update
      result = extract
      return result if result.is_a?(Hash) && result[:text]

      parsed = parse_extraction(result)
      changes = parsed[:changes]
      target = parsed[:target]

      if missing_changes?(changes)
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_UPDATE_CHANGES,
          { 'target' => target }
        )
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'update_event_changes',
            missing_fields: ['changes'],
            extracted: target,
            fallback: "What should I change about the event?"
          )
        )
      end

      if missing_target?(target)
        if (recent_event = handler.send(:last_event_record))
          return confirm_or_update(recent_event, changes)
        end
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_UPDATE_TARGET,
          { 'changes' => changes }
        )
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'update_event_target',
            missing_fields: ['title', 'date'],
            extracted: changes,
            fallback: "Which event should I update? Please share the title and date."
          )
        )
      end

      find_and_update(target, changes)
    end

    def handle_target_clarification(payload)
      changes = payload['changes'] || {}
      query = handler.send(:extract_event_query)
      return query if query.is_a?(Hash) && query[:text]

      data = query[:event]

      if data['error']
        if (recent_event = handler.send(:last_event_record))
          handler.send(:clear_thread_state)
          return confirm_or_update(recent_event, changes)
        end
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'update_event_target',
            missing_fields: ['title', 'date'],
            extracted: changes,
            fallback: "I still need the event title or date."
          )
        )
      end

      find_and_update(data, changes, clear_state: true)
    end

    def handle_changes_clarification(payload)
      target = (payload['target'] || {}).compact
      result = extract
      return result if result.is_a?(Hash) && result[:text]

      parsed = parse_extraction(result)
      changes = parsed[:changes]

      if missing_changes?(changes)
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'update_event_changes',
            missing_fields: ['changes'],
            extracted: target,
            fallback: "I still need what to change (time, date, title, etc.)."
          )
        )
      end

      target = parsed[:target] if target.empty?
      if target.empty?
        if (recent_event = handler.send(:last_event_record))
          handler.send(:clear_thread_state)
          return confirm_or_update(recent_event, changes)
        end
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_UPDATE_TARGET,
          { 'changes' => changes }
        )
        return handler.build_response("Which event should I update? Please share the title and date.")
      end

      find_and_update(target, changes, clear_state: true)
    end

    def handle_selection(payload)
      candidates = (payload['candidates'] || []).map { |entry| handler.send(:symbolize_candidate, entry) }.compact
      selected = handler.send(:pick_candidate, candidates)

      unless selected
        return handler.build_response("Reply with the number of the event you want.")
      end

      event_record = selected[:event]
      changes = payload['changes'] || {}

      handler.send(:log_action,
        handler.message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::SELECT_CALENDAR_EVENT,
        metadata: {
          selection_kind: 'update',
          candidates: payload['candidates'],
          selected_event: handler.send(:event_snapshot, event_record),
          changes: changes
        }
      )

      handler.send(:clear_thread_state)
      confirm_or_update(event_record, changes)
    end

    def handle_recurring_scope(payload)
      scope = handler.send(:resolve_recurring_scope, handler.text)[:scope]
      unless scope
        return handler.build_response("Reply \"this\" to change only this event or \"all\" for the whole series.")
      end

      event_record = CalendarEvent.find_by(id: payload['event_id'])
      unless event_record
        handler.send(:clear_thread_state)
        return handler.build_response("I couldn't find that event anymore.", error_code: ChatConstants::ErrorCode::EVENT_NOT_FOUND)
      end

      handler.send(:clear_thread_state)
      changes = payload['changes'] || {}
      changes['recurring_scope'] = scope
      handler.send(:apply_event_update, event_record, changes, snapshot: payload['snapshot'])
    end

    def handle_confirmation(payload)
      event_id = payload['event_id']
      snapshot = payload['snapshot']
      changes = payload['changes'] || {}
      event_record = CalendarEvent.find_by(id: event_id)

      unless event_record
        calendar_id = snapshot.is_a?(Hash) ? (snapshot['calendar_id'] || snapshot[:calendar_id]) : nil
        handler.send(:log_action,
          handler.message,
          calendar_event_id: nil,
          calendar_id: calendar_id,
          status: ChatConstants::Status::ERROR,
          action_type: ChatConstants::ActionType::UPDATE_CALENDAR_EVENT,
          metadata: { error_code: ChatConstants::ErrorCode::EVENT_NOT_FOUND, event_id: event_id, snapshot: snapshot }
        )
        return handler.build_response("I couldn't find that event anymore.", error_code: ChatConstants::ErrorCode::EVENT_NOT_FOUND)
      end

      if handler.send(:affirmative?)
        handler.send(:clear_thread_state)
        return handler.send(:apply_event_update, event_record, changes, snapshot: snapshot)
      end

      handler.send(:clear_thread_state)
      handler.build_response("Okay, what should I change?")
    end

    private

    def find_and_update(target, changes, clear_state: false)
      candidates = handler.send(:find_event_candidates_with_fallback, target)

      if candidates.empty?
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_UPDATE_TARGET,
          { 'changes' => changes }
        )
        return handler.build_response(
          handler.send(:clarify_missing_details,
            intent: 'update_event_target',
            missing_fields: ['title', 'date'],
            extracted: changes,
            fallback: "I couldn't find that event. Can you share the title and date?"
          )
        )
      end

      handle_candidates(candidates, changes, clear_state: clear_state)
    end

    def handle_candidates(candidates, changes, clear_state: false)
      if candidates.length > 1
        if (auto_pick = handler.send(:auto_pick_candidate, candidates))
          handler.send(:clear_thread_state) if clear_state
          return confirm_or_update(auto_pick[:event], changes)
        end
        payload = {
          'candidates' => handler.send(:serialize_candidates, candidates),
          'changes' => changes
        }
        handler.send(:set_pending_action, ChatConstants::PendingAction::SELECT_EVENT_FOR_UPDATE, payload)
        return handler.build_response("Which event should I update?\n#{handler.send(:format_candidates, candidates)}")
      end

      handler.send(:clear_thread_state) if clear_state
      confirm_or_update(candidates.first[:event], changes)
    end

    def confirm_or_update(event_record, changes)
      confidence = handler.send(:normalize_confidence, changes['confidence'])
      scope = changes['recurring_scope'] || handler.send(:resolve_recurring_scope, handler.text)[:scope]

      if handler.send(:recurring_event?, event_record) && scope.nil?
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_RECURRING_SCOPE,
          {
            'event_id' => event_record.id,
            'changes' => changes,
            'snapshot' => handler.send(:event_snapshot, event_record),
            'action' => 'update'
          }
        )
        return handler.build_response("This event repeats. Update just this event or the whole series? Reply \"this\" or \"all\".")
      end

      if scope == 'instance' && (changes['recurrence'] || changes['recurrence_clear'])
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CLARIFY_RECURRING_SCOPE,
          {
            'event_id' => event_record.id,
            'changes' => changes,
            'snapshot' => handler.send(:event_snapshot, event_record),
            'action' => 'update'
          }
        )
        return handler.build_response("Recurrence changes apply to the whole series. Update the series instead? Reply \"all\" or \"this\" to pick.")
      end

      changes['recurring_scope'] = scope if scope
      snapshot = handler.send(:event_snapshot, event_record)

      if confidence != 'high'
        handler.send(:set_pending_action,
          ChatConstants::PendingAction::CONFIRM_UPDATE,
          { 'event_id' => event_record.id, 'changes' => changes, 'snapshot' => snapshot }
        )
        return handler.build_response("I plan to update:\n#{handler.send(:format_event_changes, event_record, changes)}\n\nShould I apply this?")
      end

      handler.send(:apply_event_update, event_record, changes, snapshot: snapshot)
    end
  end
end
