require 'digest'

class SyncCalendarBusyBlocks
  @queue = :calendar

  WINDOW_DAYS = 30

  def self.perform
    CalendarConnection.where(busy_only: true, sync_enabled: true).includes(:user).find_each do |connection|
      user = connection.user
      next if user.nil? || user.google_refresh_token.to_s.empty?

      begin
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
      rescue GoogleCalendarClient::CalendarAuthError => e
        fingerprint = token_fingerprint(user.google_refresh_token)
        handle_calendar_auth_expired!(user, error: e.message, calendar_id: connection.calendar_id, source: 'calendar_busy_sync')
        Rails.logger.warn("[CalendarBusySync] Auth expired user_id=#{user.id} calendar_id=#{connection.calendar_id} token_fingerprint=#{fingerprint} error=#{e.message}")
      rescue GoogleCalendarClient::CalendarError => e
        Rails.logger.warn("[CalendarBusySync] Sync failed user_id=#{user.id} calendar_id=#{connection.calendar_id} error=#{e.message}")
      end
    end
  end

  def self.parse_time(value)
    return value if value.is_a?(Time) || value.is_a?(DateTime)

    Time.zone.parse(value.to_s)
  rescue StandardError
    nil
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
