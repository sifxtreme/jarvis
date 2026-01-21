module ChatHelpers
  module CalendarActions
    def create_event(event)
      if event['error']
        log_action(@message, calendar_event_id: nil, calendar_id: primary_calendar_id, status: ChatConstants::Status::ERROR, action_type: ChatConstants::ActionType::CREATE_CALENDAR_EVENT, metadata: { error: event['message'] })
        return build_response(render_extraction_result(event))
      end
      if @user.google_refresh_token.to_s.empty?
        log_action(
          @message,
          calendar_event_id: nil,
          calendar_id: primary_calendar_id,
          status: ChatConstants::Status::ERROR,
          action_type: ChatConstants::ActionType::CREATE_CALENDAR_EVENT,
          metadata: { error_code: ChatConstants::ErrorCode::INSUFFICIENT_PERMISSIONS, correlation_id: @correlation_id }
        )
        return build_response("Please connect your calendar at https://finances.sifxtre.me first.", error_code: ChatConstants::ErrorCode::INSUFFICIENT_PERMISSIONS)
      end

      calendar_id = primary_calendar_id
      calendar = GoogleCalendarClient.new(@user)
      attendees = (spouse_emails(@user) + [@user.email]).uniq
      recurrence_rules = build_recurrence_rules(event['recurrence'], start_date: event['date'])

      idempotency_payload = { event: event, attendees: attendees, calendar_id: calendar_id }
      signature = idempotency_signature(ChatConstants::ActionType::CREATE_CALENDAR_EVENT, idempotency_payload)
      if duplicate_action?(ChatConstants::ActionType::CREATE_CALENDAR_EVENT, signature)
        log_action(
          @message,
          calendar_event_id: nil,
          calendar_id: calendar_id,
          status: ChatConstants::Status::DUPLICATE,
          action_type: ChatConstants::ActionType::CREATE_CALENDAR_EVENT,
          metadata: { error_code: 'duplicate_request', event: event, correlation_id: @correlation_id }
        )
        return build_response("I already added that event. ✅", action: ChatConstants::FrontendAction::CALENDAR_EVENT_CREATED)
      end

      result = calendar.create_event(
        event,
        calendar_id: calendar_id,
        attendees: attendees,
        guests_can_modify: true,
        recurrence_rules: recurrence_rules
      )

      calendar_event = CalendarEvent.create!(
        user: @user,
        calendar_id: calendar_id,
        event_id: result.id,
        title: result.summary,
        description: result.description,
        location: result.location,
        start_at: result.start&.date_time,
        end_at: result.end&.date_time,
        attendees: attendees.map { |email| { email: email } },
        raw_event: result.to_h,
        source: 'web'
      )

      log_action(
        @message,
        calendar_event_id: calendar_event.id,
        calendar_id: calendar_event.calendar_id,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::CREATE_CALENDAR_EVENT,
        metadata: {
          event_id: calendar_event.event_id,
          title: calendar_event.title,
          confidence: event['confidence'],
          calendar_request: { event: event, attendees: attendees, calendar_id: calendar_id, recurrence_rules: recurrence_rules },
          calendar_response: result.to_h,
          correlation_id: @correlation_id
        }.compact
      )
      remember_last_event(calendar_event.id)
      remember_idempotency!(ChatConstants::ActionType::CREATE_CALENDAR_EVENT, signature)

      response_lines = [
        "Added to your calendar! ✅",
        "Title: #{result.summary}",
        "Date: #{event_date(result)}",
        "Time: #{event_time_range(result)}",
        "Guests: #{attendees.join(', ')}",
        "Link: #{result.html_link}"
      ]
      if recurrence_rules.present?
        response_lines << "Recurrence: #{recurrence_rules.join(', ')}"
      end
      build_response(response_lines.compact.join("\n"), event_created: true, action: ChatConstants::FrontendAction::CALENDAR_EVENT_CREATED)
    rescue GoogleCalendarClient::CalendarAuthError => e
      fingerprint = token_fingerprint(@user&.google_refresh_token)
      handle_calendar_auth_expired!(
        @user,
        error: e.message,
        calendar_id: primary_calendar_id,
        source: 'web_chat_create'
      )
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: primary_calendar_id,
        status: ChatConstants::Status::ERROR,
        action_type: ChatConstants::ActionType::CREATE_CALENDAR_EVENT,
        metadata: {
          error_code: 'calendar_auth_expired',
          error: e.message,
          token_fingerprint: fingerprint,
          correlation_id: @correlation_id
        }
      )
      build_response(
        "Your calendar authorization expired. Please reconnect at https://finances.sifxtre.me.",
        error_code: 'calendar_auth_expired'
      )
    rescue GoogleCalendarClient::CalendarError => e
      log_action(
        @message,
        calendar_event_id: nil,
        calendar_id: primary_calendar_id,
        status: ChatConstants::Status::ERROR,
        action_type: ChatConstants::ActionType::CREATE_CALENDAR_EVENT,
        metadata: { error_code: 'calendar_create_failed', error: e.message, correlation_id: @correlation_id }
      )
      build_response("Calendar error: #{e.message}", error_code: 'calendar_create_failed')
    end

    def apply_event_update(event_record, changes, snapshot: nil)
      if @user.google_refresh_token.to_s.empty?
        log_action(
          @message,
          calendar_event_id: event_record.id,
          calendar_id: event_record.calendar_id,
          status: ChatConstants::Status::ERROR,
          action_type: ChatConstants::ActionType::UPDATE_CALENDAR_EVENT,
          metadata: { error_code: ChatConstants::ErrorCode::INSUFFICIENT_PERMISSIONS, event_id: event_record.event_id, correlation_id: @correlation_id }
        )
        return build_response("Please connect your calendar at https://finances.sifxtre.me first.", error_code: ChatConstants::ErrorCode::INSUFFICIENT_PERMISSIONS)
      end

      updates = build_event_updates(event_record, changes)
      if updates.nil?
        return build_response("I need a new date or time to update the event.", error_code: ChatConstants::ErrorCode::MISSING_EVENT_UPDATE_FIELDS)
      end

      scope = changes['recurring_scope'] || ChatConstants::RecurringScope::INSTANCE
      target_event_id = scope == ChatConstants::RecurringScope::SERIES ? recurring_master_event_id(event_record) : event_record.event_id

      idempotency_payload = { event_id: target_event_id, changes: changes, scope: scope }
      signature = idempotency_signature(ChatConstants::ActionType::UPDATE_CALENDAR_EVENT, idempotency_payload)
      if duplicate_action?(ChatConstants::ActionType::UPDATE_CALENDAR_EVENT, signature)
        log_action(
          @message,
          calendar_event_id: event_record.id,
          calendar_id: event_record.calendar_id,
          status: ChatConstants::Status::DUPLICATE,
          action_type: ChatConstants::ActionType::UPDATE_CALENDAR_EVENT,
          metadata: { error_code: 'duplicate_request', event_id: target_event_id, changes: changes, scope: scope, correlation_id: @correlation_id }
        )
        return build_response("I already applied that update. ✅", action: ChatConstants::FrontendAction::CALENDAR_EVENT_UPDATED)
      end

      client = GoogleCalendarClient.new(@user)
      result = client.update_event(calendar_id: event_record.calendar_id, event_id: target_event_id, updates: updates)

      verified_event = nil
      verification = { verified: false }
      begin
        verified_event = client.get_event(calendar_id: event_record.calendar_id, event_id: target_event_id)
        verification = verify_event_updates(verified_event, updates)
      rescue GoogleCalendarClient::CalendarError => e
        verification = { verified: false, error: e.message }
      end

      detached_instance = nil
      if scope == ChatConstants::RecurringScope::INSTANCE && updates['recurrence_clear']
        detached_instance = client.detach_instance(
          calendar_id: event_record.calendar_id,
          instance_id: target_event_id,
          event: verified_event || result
        )
      end

      event_source = detached_instance || verified_event || result
      update_payload = {
        title: event_source.summary,
        description: event_source.description,
        location: event_source.location,
        start_at: event_source.start&.date_time || event_source.start&.date,
        end_at: event_source.end&.date_time || event_source.end&.date,
        raw_event: event_source.to_h,
        status: ChatConstants::RecordStatus::ACTIVE
      }
      update_payload[:event_id] = event_source.id if detached_instance
      event_record.update!(update_payload)

      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::UPDATE_CALENDAR_EVENT,
        metadata: {
          event_id: target_event_id,
          title: event_record.title,
          changes: changes,
          updates: updates,
          snapshot: snapshot,
          calendar_response: event_source.to_h,
          detached_instance_id: detached_instance ? target_event_id : nil,
          detached_event_id: detached_instance&.id,
          verification: verification,
          scope: scope,
          correlation_id: @correlation_id
        }.compact
      )
      remember_last_event(event_record.id)
      remember_idempotency!(ChatConstants::ActionType::UPDATE_CALENDAR_EVENT, signature)
      refresh_household_calendar_data

      if verification[:mismatches].to_a.any?
        return build_response(
          "Updated the event, but these fields may not have changed: #{verification[:mismatches].join(', ')}.",
          action: ChatConstants::FrontendAction::CALENDAR_EVENT_UPDATED,
          error_code: 'calendar_update_partial'
        )
      end

      response_lines = [
        "Updated the event. ✅",
        "Title: #{event_source.summary}",
        "Date: #{event_date(event_source)}",
        "Time: #{event_time_range(event_source)}",
        "Scope: #{scope_label(scope, detached_instance: detached_instance)}"
      ]
      if updates['recurrence_clear']
        response_lines << "Recurrence: cleared"
      elsif updates['recurrence_rules']
        response_lines << "Recurrence: #{updates['recurrence_rules'].join(', ')}"
      end
      if detached_instance
        response_lines << "Detached: this instance is now standalone"
      end
      build_response(response_lines.compact.join("\n"), event_created: true, action: ChatConstants::FrontendAction::CALENDAR_EVENT_UPDATED)
    rescue GoogleCalendarClient::CalendarAuthError => e
      fingerprint = token_fingerprint(@user&.google_refresh_token)
      handle_calendar_auth_expired!(
        @user,
        error: e.message,
        calendar_id: event_record.calendar_id,
        source: 'web_chat_update'
      )
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::ERROR,
        action_type: ChatConstants::ActionType::UPDATE_CALENDAR_EVENT,
        metadata: {
          error_code: 'calendar_auth_expired',
          error: e.message,
          token_fingerprint: fingerprint,
          event_id: target_event_id,
          changes: changes,
          scope: scope,
          correlation_id: @correlation_id
        }
      )
      build_response(
        "Your calendar authorization expired. Please reconnect at https://finances.sifxtre.me.",
        error_code: 'calendar_auth_expired'
      )
    rescue GoogleCalendarClient::CalendarError => e
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::ERROR,
        action_type: ChatConstants::ActionType::UPDATE_CALENDAR_EVENT,
        metadata: {
          error_code: 'calendar_update_failed',
          error: e.message,
          event_id: target_event_id,
          changes: changes,
          scope: scope,
          correlation_id: @correlation_id
        }
      )
      build_response("Calendar update error: #{e.message}", error_code: 'calendar_update_failed')
    end

    def delete_event(event_record, scope: nil)
      if @user.google_refresh_token.to_s.empty?
        log_action(
          @message,
          calendar_event_id: event_record.id,
          calendar_id: event_record.calendar_id,
          status: ChatConstants::Status::ERROR,
          action_type: ChatConstants::ActionType::DELETE_CALENDAR_EVENT,
          metadata: { error_code: ChatConstants::ErrorCode::INSUFFICIENT_PERMISSIONS, event_id: event_record.event_id, correlation_id: @correlation_id }
        )
        return build_response("Please connect your calendar at https://finances.sifxtre.me first.", error_code: ChatConstants::ErrorCode::INSUFFICIENT_PERMISSIONS)
      end

      scope ||= ChatConstants::RecurringScope::INSTANCE
      target_event_id = scope == ChatConstants::RecurringScope::SERIES ? recurring_master_event_id(event_record) : event_record.event_id

      signature = idempotency_signature(ChatConstants::ActionType::DELETE_CALENDAR_EVENT, { event_id: target_event_id, scope: scope })
      if duplicate_action?(ChatConstants::ActionType::DELETE_CALENDAR_EVENT, signature)
        log_action(
          @message,
          calendar_event_id: event_record.id,
          calendar_id: event_record.calendar_id,
          status: ChatConstants::Status::DUPLICATE,
          action_type: ChatConstants::ActionType::DELETE_CALENDAR_EVENT,
          metadata: { error_code: 'duplicate_request', event_id: target_event_id, scope: scope, correlation_id: @correlation_id }
        )
        return build_response("I already deleted that event. ✅", action: ChatConstants::FrontendAction::CALENDAR_EVENT_DELETED)
      end

      client = GoogleCalendarClient.new(@user)
      client.delete_event(calendar_id: event_record.calendar_id, event_id: target_event_id)
      event_record.update!(status: ChatConstants::RecordStatus::CANCELLED)

      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::SUCCESS,
        action_type: ChatConstants::ActionType::DELETE_CALENDAR_EVENT,
        metadata: {
          event_id: target_event_id,
          title: event_record.title,
          calendar_request: { calendar_id: event_record.calendar_id, event_id: target_event_id },
          scope: scope,
          correlation_id: @correlation_id
        }
      )
      remember_idempotency!(ChatConstants::ActionType::DELETE_CALENDAR_EVENT, signature)
      response_lines = [
        "Deleted the event. ✅",
        "Title: #{event_record.title}",
        "Date: #{event_record_date(event_record)}",
        "Time: #{event_record_time_range(event_record)}",
        "Scope: #{scope_label(scope, detached_instance: false)}"
      ]
      build_response(response_lines.compact.join("\n"), event_created: true, action: ChatConstants::FrontendAction::CALENDAR_EVENT_DELETED)
    rescue GoogleCalendarClient::CalendarAuthError => e
      fingerprint = token_fingerprint(@user&.google_refresh_token)
      handle_calendar_auth_expired!(
        @user,
        error: e.message,
        calendar_id: event_record.calendar_id,
        source: 'web_chat_delete'
      )
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::ERROR,
        action_type: ChatConstants::ActionType::DELETE_CALENDAR_EVENT,
        metadata: {
          error_code: 'calendar_auth_expired',
          error: e.message,
          token_fingerprint: fingerprint,
          event_id: target_event_id,
          scope: scope,
          correlation_id: @correlation_id
        }
      )
      build_response(
        "Your calendar authorization expired. Please reconnect at https://finances.sifxtre.me.",
        error_code: 'calendar_auth_expired'
      )
    rescue GoogleCalendarClient::CalendarError => e
      log_action(
        @message,
        calendar_event_id: event_record.id,
        calendar_id: event_record.calendar_id,
        status: ChatConstants::Status::ERROR,
        action_type: ChatConstants::ActionType::DELETE_CALENDAR_EVENT,
        metadata: { error_code: 'calendar_delete_failed', error: e.message, event_id: target_event_id, scope: scope, correlation_id: @correlation_id }
      )
      build_response("Calendar delete error: #{e.message}", error_code: 'calendar_delete_failed')
    end

    def primary_calendar_id
      CalendarConnection.where(user: @user, primary: true).limit(1).pluck(:calendar_id).first || @user.email || 'primary'
    end

    def refresh_household_calendar_data
      users = household_users
      users.each do |user|
        next if user.google_refresh_token.to_s.empty?

        begin
          sync_calendar_list_for(user)
        rescue GoogleCalendarClient::CalendarAuthError => e
          handle_calendar_auth_expired!(
            user,
            error: e.message,
            calendar_id: nil,
            source: 'calendar_list_sync'
          )
          Rails.logger.warn("[CalendarUpdate] Calendar auth expired user_id=#{user.id} error=#{e.message}")
        rescue GoogleCalendarClient::CalendarError => e
          Rails.logger.warn("[CalendarUpdate] Calendar list sync failed user_id=#{user.id} error=#{e.message}")
        end
      end

      begin
        SyncCalendarEvents.perform_for_users(users)
      rescue StandardError => e
        Rails.logger.warn("[CalendarSync] Failed during chat refresh user_id=#{@user&.id} error=#{e.message}")
      end
    end

    def sync_calendar_list_for(user)
      client = GoogleCalendarClient.new(user)
      calendars = client.list_calendars

      calendars.each do |cal|
        next unless cal[:primary] || cal[:access_role] == 'freeBusyReader'

        CalendarConnection.find_or_initialize_by(user: user, calendar_id: cal[:id]).update(
          summary: cal[:summary],
          access_role: cal[:access_role],
          primary: cal[:primary] || false,
          busy_only: cal[:access_role] == 'freeBusyReader',
          sync_enabled: true,
          time_zone: cal[:time_zone]
        )
      end
    end

    def handle_calendar_auth_expired!(user, error: nil, calendar_id: nil, source: 'unknown')
      return if user.nil?

      fingerprint = token_fingerprint(user.google_refresh_token)
      user.update(google_refresh_token: nil)
      CalendarConnection.where(user: user).update_all(sync_enabled: false)
      CalendarAuthLog.create!(
        user: user,
        calendar_id: calendar_id,
        source: source,
        error_code: 'invalid_grant',
        error_message: error,
        token_fingerprint: fingerprint,
        metadata: { correlation_id: @correlation_id }.compact
      )
      Rails.logger.warn("[CalendarAuth] Revoked refresh token for user_id=#{user.id} token_fingerprint=#{fingerprint} error=#{error}") if error
    end

    def verify_event_updates(event, updates)
      return { verified: false, error: 'missing_event' } unless event

      mismatches = []
      mismatches << 'title' if updates['title'] && event.summary.to_s != updates['title'].to_s
      mismatches << 'location' if updates['location'] && event.location.to_s != updates['location'].to_s
      mismatches << 'description' if updates['description'] && event.description.to_s != updates['description'].to_s

      actual_date = event.start&.date || event.start&.date_time&.to_date&.iso8601
      actual_start_time = event.start&.date_time&.strftime('%H:%M')
      actual_end_time = event.end&.date_time&.strftime('%H:%M')

      mismatches << 'date' if updates['date'] && actual_date.to_s != updates['date'].to_s
      mismatches << 'start_time' if updates['start_time'] && actual_start_time.to_s != updates['start_time'].to_s
      mismatches << 'end_time' if updates['end_time'] && actual_end_time.to_s != updates['end_time'].to_s
      if updates['recurrence_rules']
        actual_recurrence = Array(event.recurrence).map(&:to_s)
        mismatches << 'recurrence' if actual_recurrence != Array(updates['recurrence_rules']).map(&:to_s)
      end

      {
        verified: true,
        mismatches: mismatches,
        actual: {
          date: actual_date,
          start_time: actual_start_time,
          end_time: actual_end_time
        }
      }
    end
  end
end
