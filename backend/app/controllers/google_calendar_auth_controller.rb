require 'cgi'

class GoogleCalendarAuthController < ActionController::API
  def callback
    auth = request.env['omniauth.auth']
    email = auth.dig('info', 'email')
    refresh_token = auth.dig('credentials', 'refresh_token')
    google_sub = auth.dig('uid')

    unless email
      return redirect_with_error("Missing email from Google.")
    end

    user = User.find_or_create_by(email: email) do |record|
      record.password_hash = 'unused'
    end

    unless user.active?
      return redirect_with_error("User not allowed.")
    end

    user.update!(
      google_sub: google_sub,
      google_refresh_token: refresh_token.presence || user.google_refresh_token
    )

    sync_calendar_list(user)

    redirect_to "#{frontend_url}?calendar_connected=1"
  rescue StandardError => e
    Rails.logger.error "[GoogleCalendarAuth] #{e.message}"
    redirect_with_error("Calendar auth failed.")
  end

  private

  def frontend_url
    ENV.fetch('FRONTEND_URL', 'https://finances.sifxtre.me')
  end

  def redirect_with_error(message)
    redirect_to "#{frontend_url}?calendar_error=#{CGI.escape(message)}"
  end

  def sync_calendar_list(user)
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
  rescue StandardError => e
    Rails.logger.warn "[GoogleCalendarAuth] Calendar list sync failed: #{e.message}"
  end
end
