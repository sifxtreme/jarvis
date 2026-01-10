require 'digest'

class SyncCalendarEvents
  @queue = :calendar

  WINDOW_DAYS = 30
  PAST_DAYS = 3

  def self.perform
    sync_connections(CalendarConnection.where(sync_enabled: true).includes(:user))
  end

  def self.perform_for_users(users)
    return if users.blank?

    sync_connections(CalendarConnection.where(sync_enabled: true, user: users).includes(:user))
  end

  def self.sync_connections(connections)
    connections.find_each do |connection|
      user = connection.user
      next if user.nil? || user.google_refresh_token.to_s.empty?

      begin
        client = GoogleCalendarClient.new(user)
        time_min = Time.current.beginning_of_day - PAST_DAYS.days
        time_max = time_min + WINDOW_DAYS.days

        if connection.busy_only
          sync_busy_blocks(connection, client, time_min, time_max)
        else
          sync_full_events(connection, client, time_min, time_max)
        end
      rescue GoogleCalendarClient::CalendarAuthError => e
        fingerprint = token_fingerprint(user.google_refresh_token)
        handle_calendar_auth_expired!(user, error: e.message, calendar_id: connection.calendar_id, source: 'calendar_sync')
        Rails.logger.warn("[CalendarSync] Auth expired user_id=#{user.id} calendar_id=#{connection.calendar_id} token_fingerprint=#{fingerprint} error=#{e.message}")
      rescue GoogleCalendarClient::CalendarError => e
        Rails.logger.warn("[CalendarSync] Sync failed user_id=#{user.id} calendar_id=#{connection.calendar_id} error=#{e.message}")
      end
    end
  end

  def self.sync_busy_blocks(connection, client, time_min, time_max)
    response = client.freebusy(calendar_ids: [connection.calendar_id], time_min: time_min, time_max: time_max)
    busy_times = response.calendars[connection.calendar_id]&.busy || []

    BusyBlock.where(user_id: connection.user_id, calendar_id: connection.calendar_id)
             .where("start_at < ? OR start_at > ?", time_min, time_max)
             .delete_all

    existing = BusyBlock.where(user_id: connection.user_id, calendar_id: connection.calendar_id)
                        .where(start_at: time_min..time_max)
                        .pluck(:id, :start_at, :end_at)
                        .map { |id, start_at, end_at| [busy_key(start_at, end_at), id] }
                        .to_h

    seen_keys = []
    busy_times.each do |block|
      start_at = parse_time(block.start)
      end_at = parse_time(block.end)
      next unless start_at && end_at

      key = busy_key(start_at, end_at)
      seen_keys << key

      next if existing.key?(key)

      BusyBlock.create!(
        user_id: connection.user_id,
        calendar_id: connection.calendar_id,
        start_at: start_at,
        end_at: end_at
      )
    end

    stale_ids = existing.reject { |key, _id| seen_keys.include?(key) }.values
    BusyBlock.where(id: stale_ids).delete_all if stale_ids.any?

    connection.update(last_synced_at: Time.current)
  end

  def self.sync_full_events(connection, client, time_min, time_max)
    events = client.list_events(
      calendar_id: connection.calendar_id,
      time_min: time_min,
      time_max: time_max
    )

    existing = CalendarEvent.where(user_id: connection.user_id, calendar_id: connection.calendar_id)
                            .index_by(&:event_id)

    seen_ids = []

    events.each do |event|
      if event.status == 'cancelled'
        if existing_event = existing[event.id]
          existing_event.update(status: 'cancelled')
        end
        seen_ids << event.id
        next
      end

      start_at = parse_time(event.start.date_time || event.start.date)
      end_at = parse_time(event.end.date_time || event.end.date)

      seen_ids << event.id
      attrs = {
        title: event.summary,
        description: event.description,
        location: event.location,
        start_at: start_at,
        end_at: end_at,
        attendees: (event.attendees || []).map { |a| { email: a.email, response_status: a.response_status } },
        raw_event: event.to_h,
        source: 'google_sync',
        status: 'active'
      }

      if existing_event = existing[event.id]
        existing_event.update(attrs.merge(calendar_id: connection.calendar_id))
      else
        CalendarEvent.create!(
          attrs.merge(
            user_id: connection.user_id,
            calendar_id: connection.calendar_id,
            event_id: event.id
          )
        )
      end
    end

    CalendarEvent.where(user_id: connection.user_id, calendar_id: connection.calendar_id)
                 .where(start_at: time_min..time_max)
                 .where.not(event_id: seen_ids)
                 .update_all(status: 'cancelled')

    connection.update(last_synced_at: Time.current)
  end

  def self.parse_time(value)
    return nil if value.to_s.empty?

    Time.zone.parse(value.to_s)
  rescue StandardError
    nil
  end

  def self.busy_key(start_at, end_at)
    "#{start_at.iso8601}-#{end_at.iso8601}"
  end

  def self.handle_calendar_auth_expired!(user, error: nil, calendar_id: nil, source: 'unknown')
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
      token_fingerprint: fingerprint
    )
    Rails.logger.warn("[CalendarAuth] Revoked refresh token for user_id=#{user.id} token_fingerprint=#{fingerprint} error=#{error}") if error
  end

  def self.token_fingerprint(token)
    return nil if token.to_s.empty?

    Digest::SHA256.hexdigest(token.to_s)[0, 12]
  end
end
