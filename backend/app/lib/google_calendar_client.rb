require 'google/apis/calendar_v3'
require 'signet/oauth_2/client'

class GoogleCalendarClient
  class CalendarError < StandardError; end

  def initialize(user)
    @user = user
    @client = build_oauth_client
    @service = Google::Apis::CalendarV3::CalendarService.new
    @service.authorization = @client
  end

  def list_calendars
    result = @service.list_calendar_lists
    result.items.map do |cal|
      {
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
        access_role: cal.access_role,
        time_zone: cal.time_zone
      }
    end
  rescue Google::Apis::Error => e
    raise CalendarError, e.message
  end

  def create_event(event, calendar_id: 'primary', attendees: [], guests_can_modify: true)
    start_time = parse_datetime(event['date'], event['start_time'])
    end_time = parse_datetime(event['date'], event['end_time'])

    if start_time.nil?
      start_date = Date.parse(event['date'])
      end_date = start_date + 1.day
      start_field = Google::Apis::CalendarV3::EventDateTime.new(date: start_date.iso8601)
      end_field = Google::Apis::CalendarV3::EventDateTime.new(date: end_date.iso8601)
    else
      end_time ||= start_time + 1.hour
      start_field = Google::Apis::CalendarV3::EventDateTime.new(
        date_time: start_time.iso8601,
        time_zone: time_zone
      )
      end_field = Google::Apis::CalendarV3::EventDateTime.new(
        date_time: end_time.iso8601,
        time_zone: time_zone
      )
    end

    calendar_event = Google::Apis::CalendarV3::Event.new(
      summary: event['title'],
      location: event['location'],
      description: event['description'],
      start: start_field,
      end: end_field,
      attendees: attendees.map { |email| Google::Apis::CalendarV3::EventAttendee.new(email: email) },
      guests_can_modify: guests_can_modify,
      guests_can_invite_others: true,
      guests_can_see_other_guests: true
    )

    @service.insert_event(calendar_id, calendar_event)
  rescue Google::Apis::Error => e
    raise CalendarError, e.message
  end

  def freebusy(calendar_ids:, time_min:, time_max:)
    request = Google::Apis::CalendarV3::FreeBusyRequest.new(
      time_min: time_min.iso8601,
      time_max: time_max.iso8601,
      items: calendar_ids.map { |id| { id: id } }
    )

    @service.query_freebusy(request)
  rescue Google::Apis::Error => e
    raise CalendarError, e.message
  end

  def list_events(calendar_id:, time_min:, time_max:)
    events = []
    page_token = nil

    loop do
      result = @service.list_events(
        calendar_id,
        time_min: time_min.iso8601,
        time_max: time_max.iso8601,
        single_events: true,
        order_by: 'startTime',
        page_token: page_token
      )
      events.concat(result.items)
      page_token = result.next_page_token
      break if page_token.to_s.empty?
    end

    events
  rescue Google::Apis::Error => e
    raise CalendarError, e.message
  end

  def delete_event(calendar_id:, event_id:)
    @service.delete_event(calendar_id, event_id)
  rescue Google::Apis::Error => e
    raise CalendarError, e.message
  end

  def update_event(calendar_id:, event_id:, updates:)
    event = @service.get_event(calendar_id, event_id)
    event.summary = updates['title'] if updates['title']
    event.location = updates['location'] if updates['location']
    event.description = updates['description'] if updates['description']

    if updates['date']
      start_time = parse_datetime(updates['date'], updates['start_time'])
      end_time = parse_datetime(updates['date'], updates['end_time'])

      if start_time.nil?
        start_date = Date.parse(updates['date'])
        end_date = start_date + 1.day
        event.start = Google::Apis::CalendarV3::EventDateTime.new(date: start_date.iso8601)
        event.end = Google::Apis::CalendarV3::EventDateTime.new(date: end_date.iso8601)
      else
        end_time ||= start_time + 1.hour
        event.start = Google::Apis::CalendarV3::EventDateTime.new(
          date_time: start_time.iso8601,
          time_zone: time_zone
        )
        event.end = Google::Apis::CalendarV3::EventDateTime.new(
          date_time: end_time.iso8601,
          time_zone: time_zone
        )
      end
    end

    @service.update_event(calendar_id, event_id, event)
  rescue Google::Apis::Error => e
    raise CalendarError, e.message
  end

  private

  def build_oauth_client
    Signet::OAuth2::Client.new(
      client_id: ENV.fetch('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: ENV.fetch('GOOGLE_OAUTH_CLIENT_SECRET'),
      token_credential_uri: 'https://oauth2.googleapis.com/token',
      refresh_token: @user.google_refresh_token
    ).tap(&:fetch_access_token!)
  end

  def parse_datetime(date_str, time_str)
    return nil if date_str.to_s.empty? || time_str.to_s.empty?

    Time.zone.parse("#{date_str} #{time_str}")
  end

  def time_zone
    'America/Los_Angeles'
  end
end
