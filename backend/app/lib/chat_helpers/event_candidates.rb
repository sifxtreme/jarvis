module ChatHelpers
  module EventCandidates
    def handle_event_candidate_flow(data, action_type:, changes: nil, clarify_action:, clarify_fallback:, clear_state: false, set_pending: true)
      candidates = find_event_candidates_with_fallback(data)
      if candidates.empty?
        if set_pending && clarify_action
          payload = changes ? { 'changes' => changes } : {}
          set_pending_action(clarify_action, payload)
        end
        return build_response(
          clarify_missing_details(
            intent: "#{action_type}_event_target",
            missing_fields: ['title', 'date'],
            extracted: changes || {},
            fallback: clarify_fallback
          )
        )
      end

      handle_event_candidates(candidates, action_type: action_type, changes: changes, clear_state: clear_state)
    end

    def handle_event_candidates(candidates, action_type:, changes: nil, clear_state: false)
      if candidates.length > 1
        if (auto_pick = auto_pick_candidate(candidates))
          clear_thread_state if clear_state
          return action_type == 'delete' ? confirm_or_delete_event(auto_pick[:event]) : confirm_or_update_event(auto_pick[:event], changes || {})
        end
        payload = { 'candidates' => serialize_candidates(candidates) }
        payload['changes'] = changes if changes
        set_pending_action(selection_action_for(action_type), payload)
        return build_response("#{selection_prompt_for(action_type)}\n#{format_candidates(candidates)}")
      end

      clear_thread_state if clear_state
      event_record = candidates.first[:event]
      action_type == 'delete' ? confirm_or_delete_event(event_record) : confirm_or_update_event(event_record, changes || {})
    end

    def selection_action_for(action_type)
      case action_type
      when 'update'
        ChatConstants::PendingAction::SELECT_EVENT_FOR_UPDATE
      when 'delete'
        ChatConstants::PendingAction::SELECT_EVENT_FOR_DELETE
      else
        ChatConstants::PendingAction::SELECT_EVENT_FOR_UPDATE
      end
    end

    def selection_prompt_for(action_type)
      action_type == 'delete' ? 'Which event should I delete?' : 'Which event should I update?'
    end

    def list_events_for_query(data, prefer_title: false)
      title = data['title'].to_s.strip
      date = data['date'].to_s.strip
      title = fallback_list_title(title) if date.blank? && !prefer_title

      scope = CalendarEvent.where(user: @user).where.not(status: ChatConstants::RecordStatus::CANCELLED)
      if date.present?
        day = Date.parse(date) rescue nil
        if day
          zone = la_now.time_zone
          scope = scope.where(start_at: day.in_time_zone(zone).beginning_of_day..day.in_time_zone(zone).end_of_day)
        end
      elsif title.present?
        scope = scope.where(start_at: la_now..(la_now + CALENDAR_WINDOW_FUTURE_DAYS.days))
      else
        today = la_today
        zone = la_now.time_zone
        scope = scope.where(start_at: today.in_time_zone(zone).beginning_of_day..today.in_time_zone(zone).end_of_day)
      end

      scope = apply_title_filters(scope, title) if title.present?

      events = scope.order(:start_at).limit(5).to_a
      if events.empty? && title.present? && date.blank?
        events = fuzzy_event_candidates(title).map { |entry| entry[:event] }
      end

      [events, title, date]
    end

    def handle_list_empty_results(query, title:, date:)
      set_pending_action(ChatConstants::PendingAction::CLARIFY_LIST_QUERY, { 'query' => query })
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: nil,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::LIST_EVENTS,
        metadata: { query: query, result_count: 0 }
      )
      if title.empty? && date.empty?
        return build_response("No events today. Want me to check what's next on your calendar?")
      end
      build_response("I couldn't find any upcoming events that match. Want me to search a different title?")
    end

    def handle_list_empty_followup(title:, date:)
      if title.present? || date.present?
        return build_response('Still nothing. Try a more specific title or date.')
      end
      build_response("No events today. Want me to check what's next on your calendar?")
    end
  end
end
