class CalendarController < GoogleAuthController
  def calendars
    user = current_user
    return render json: { msg: 'Unauthorized' }, status: :unauthorized unless user
    return render json: { msg: 'Calendar not connected' }, status: :unprocessable_entity if user.google_refresh_token.to_s.empty?

    client = GoogleCalendarClient.new(user)
    calendars = client.list_calendars

    calendars.each do |cal|
      CalendarConnection.find_or_initialize_by(user: user, calendar_id: cal[:id]).update(
        summary: cal[:summary],
        access_role: cal[:access_role],
        primary: cal[:primary] || false,
        time_zone: cal[:time_zone]
      )
    end

    render json: calendars
  rescue GoogleCalendarClient::CalendarError => e
    render json: { msg: e.message }, status: :bad_gateway
  end

  def upsert_connection
    user = current_user
    return render json: { msg: 'Unauthorized' }, status: :unauthorized unless user

    data = params.permit(:calendar_id, :busy_only, :sync_enabled)
    connection = CalendarConnection.find_or_initialize_by(user: user, calendar_id: data[:calendar_id])
    connection.update(
      busy_only: ActiveModel::Type::Boolean.new.cast(data[:busy_only]),
      sync_enabled: ActiveModel::Type::Boolean.new.cast(data[:sync_enabled])
    )

    render json: { success: true }
  end
end
