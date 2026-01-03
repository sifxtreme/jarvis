class CalendarController < ApplicationController
  DEFAULT_WINDOW_DAYS = 30

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

  def overview
    start_time, end_time = calendar_window
    users = User.where(active: true)

    connections = CalendarConnection.where(user: users).index_by { |c| [c.user_id, c.calendar_id] }
    work_calendars = CalendarConnection.where(user: users, busy_only: true, sync_enabled: true)
                                        .select(:calendar_id, :summary)
                                        .distinct

    events = CalendarEvent.where(user: users)
                          .where.not(status: 'cancelled')
                          .where(start_at: start_time..end_time)
                          .order(:start_at)
                          .map { |event| serialize_event(event, connections) }

    busy_blocks = BusyBlock.where(user: users)
                           .where(start_at: start_time..end_time)
                           .order(:start_at)
                           .map { |block| serialize_busy(block, connections) }

    render json: {
      window: {
        start_at: start_time.iso8601,
        end_at: end_time.iso8601
      },
      users: users.map { |u| { id: u.id, email: u.email } },
      work_calendars: work_calendars.map { |cal| { calendar_id: cal.calendar_id, summary: cal.summary } },
      items: (events + busy_blocks).sort_by { |item| item[:start_at] }
    }
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

  def destroy_event
    user = current_user
    return render json: { msg: 'Unauthorized' }, status: :unauthorized unless user

    event = CalendarEvent.find_by(id: params[:id], user_id: user.id)
    return render json: { msg: 'Event not found' }, status: :not_found unless event

    client = GoogleCalendarClient.new(user)
    client.delete_event(calendar_id: event.calendar_id, event_id: event.event_id)
    event.update(status: 'cancelled')

    render json: { success: true }
  rescue GoogleCalendarClient::CalendarError => e
    render json: { msg: e.message }, status: :bad_gateway
  end

  private

  def calendar_window
    view = params[:view].to_s
    date_param = params[:date].to_s
    base_date = date_param.empty? ? Time.zone.today : Time.zone.parse(date_param).to_date

    base_date =
      case view
      when 'week', '2weeks'
        base_date.beginning_of_week(:sunday)
      when 'month'
        base_date.beginning_of_month
      else
        base_date
      end

    start_time = base_date.beginning_of_day
    days =
      case view
      when 'day'
        1
      when 'week'
        7
      when '2weeks'
        14
      when 'month'
        (base_date.end_of_month - base_date).to_i + 1
      else
        DEFAULT_WINDOW_DAYS
      end

    [start_time, start_time + days.days]
  end

  def serialize_event(event, connections)
    raw = event.raw_event || {}
    uid = raw['i_cal_uid'] || raw['iCalUID'] || event.event_id
    connection = connections[[event.user_id, event.calendar_id]]

    {
      id: event.id,
      type: 'event',
      event_id: event.event_id,
      event_uid: uid,
      title: event.title,
      description: event.description,
      location: event.location,
      start_at: event.start_at&.iso8601,
      end_at: event.end_at&.iso8601,
      calendar_id: event.calendar_id,
      calendar_summary: connection&.summary,
      user_id: event.user_id,
      busy_only: false
    }
  end

  def serialize_busy(block, connections)
    connection = connections[[block.user_id, block.calendar_id]]
    {
      id: block.id,
      type: 'busy',
      start_at: block.start_at&.iso8601,
      end_at: block.end_at&.iso8601,
      calendar_id: block.calendar_id,
      calendar_summary: connection&.summary,
      user_id: block.user_id,
      busy_only: true
    }
  end
end
