class SyncCalendarBusyBlocks
  @queue = :calendar

  WINDOW_DAYS = 30

  def self.perform
    CalendarConnection.where(busy_only: true, sync_enabled: true).includes(:user).find_each do |connection|
      user = connection.user
      next if user.nil? || user.google_refresh_token.to_s.empty?

      client = GoogleCalendarClient.new(user)
      time_min = Time.current.beginning_of_day
      time_max = time_min + WINDOW_DAYS.days

      response = client.freebusy(calendar_ids: [connection.calendar_id], time_min: time_min, time_max: time_max)
      busy_times = response.calendars[connection.calendar_id]&.busy || []

      BusyBlock.where(user_id: user.id, calendar_id: connection.calendar_id)
               .where(start_at: time_min..time_max)
               .delete_all

      busy_times.each do |block|
        start_at = parse_time(block.start)
        end_at = parse_time(block.end)
        next unless start_at && end_at

        BusyBlock.create!(
          user_id: user.id,
          calendar_id: connection.calendar_id,
          start_at: start_at,
          end_at: end_at
        )
      end

      connection.update(last_synced_at: Time.current)
    end
  end

  def self.parse_time(value)
    return value if value.is_a?(Time) || value.is_a?(DateTime)

    Time.zone.parse(value.to_s)
  rescue StandardError
    nil
  end
end
