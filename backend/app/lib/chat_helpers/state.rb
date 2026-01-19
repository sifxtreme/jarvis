module ChatHelpers
  module State
    def thread_state
      @thread.state ||= {}
    end

    def update_thread_state(next_state)
      @thread.update!(state: next_state)
    end

    def merge_thread_state(patch)
      update_thread_state(thread_state.merge(patch))
    end

    def clear_thread_state
      update_thread_state(thread_state.slice('last_event_id'))
    end

    def set_pending_action(action, payload = {})
      merge_thread_state('pending_action' => action, 'payload' => payload)
    end

    def remember_last_event(event_id)
      merge_thread_state('last_event_id' => event_id)
    end

    def last_event_record
      event_id = thread_state['last_event_id']
      return nil if event_id.blank?

      CalendarEvent.find_by(id: event_id)
    end

    def idempotency_signature(action_type, payload)
      Digest::SHA256.hexdigest([action_type, @user.id, payload.to_json].join('|'))
    end

    def duplicate_action?(action_type, signature)
      info = thread_state['last_action']
      return false unless info.is_a?(Hash)
      return false unless info['action_type'] == action_type
      return false unless info['signature'] == signature

      timestamp = Time.zone.parse(info['created_at'].to_s) rescue nil
      return false unless timestamp

      timestamp > (Time.zone.now - IDEMPOTENCY_WINDOW_SECONDS)
    end

    def remember_idempotency!(action_type, signature)
      merge_thread_state(
        'last_action' => {
          'action_type' => action_type,
          'signature' => signature,
          'created_at' => Time.zone.now.iso8601
        }
      )
    end
  end
end
