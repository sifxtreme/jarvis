class SyncCalendarEvents
  @queue = :calendar

  WINDOW_DAYS = 30

  def self.perform
    CalendarConnection.where(sync_enabled: true).includes(:user).find_each do |connection|
      user = connection.user
      next if user.nil? || user.google_refresh_token.to_s.empty?

      client = GoogleCalendarClient.new(user)
      time_min = Time.current.beginning_of_day
      time_max = time_min + WINDOW_DAYS.days

      if connection.busy_only
        sync_busy_blocks(connection, client, time_min, time_max)
      else
        sync_full_events(connection, client, time_min, time_max)
      end
    end
  end

  def self.sync_busy_blocks(connection, client, time_min, time_max)
    response = client.freebusy(calendar_ids: [connection.calendar_id], time_min: time_min, time_max: time_max)
    busy_times = response.calendars[connection.calendar_id]&.busy || []

    BusyBlock.where(user_id: connection.user_id, calendar_id: connection.calendar_id)
             .where(start_at: time_min..time_max)
             .delete_all

    busy_times.each do |block|
      start_at = parse_time(block.start)
      end_at = parse_time(block.end)
      next unless start_at && end_at

      BusyBlock.create!(
        user_id: connection.user_id,
        calendar_id: connection.calendar_id,
        start_at: start_at,
        end_at: end_at
      )
    end

    connection.update(last_synced_at: Time.current)
  end

  def self.sync_full_events(connection, client, time_min, time_max)
    events = client.list_events(
      calendar_id: connection.calendar_id,
      time_min: time_min,
      time_max: time_max
    )

    CalendarEvent.where(user_id: connection.user_id, calendar_id: connection.calendar_id)
                 .where(start_at: time_min..time_max)
                 .delete_all

    events.each do |event|
      next if event.status == 'cancelled'

      start_at = parse_time(event.start.date_time || event.start.date)
      end_at = parse_time(event.end.date_time || event.end.date)

      CalendarEvent.create!(
        user_id: connection.user_id,
        calendar_id: connection.calendar_id,
        event_id: event.id,
        title: event.summary,
        description: event.description,
        location: event.location,
        start_at: start_at,
        end_at: end_at,
        attendees: (event.attendees || []).map { |a| { email: a.email, response_status: a.response_status } },
        raw_event: event.to_h,
        source: 'google_sync'
      )
    end

    connection.update(last_synced_at: Time.current)
  end

  def self.parse_time(value)
    return nil if value.to_s.empty?

    Time.zone.parse(value.to_s)
  rescue StandardError
    nil
  end
end
