class SlackDailyDigest
  def self.perform
    new.perform
  end

  def perform
    User.where(active: true).find_each do |user|
      begin
        channel = nil
        slack_id = slack_user_id_for(user)
        if slack_id.to_s.empty?
          SlackMessageLog.create!(
            user_id: user.id,
            channel: nil,
            status: 'skipped',
            error: 'missing_slack_user_id',
            response: {}
          )
          next
        end

        dm_result = open_dm(slack_id)
        channel = dm_result[:channel]
        if channel.to_s.empty?
          SlackMessageLog.create!(
            user_id: user.id,
            channel: nil,
            status: 'skipped',
            error: 'missing_dm_channel',
            response: dm_result[:error] || {}
          )
          next
        end

        message = build_digest_message(user)
        if message.to_s.strip.empty?
          SlackMessageLog.create!(
            user_id: user.id,
            channel: channel,
            status: 'skipped',
            error: 'empty_digest',
            response: {}
          )
          next
        end

        response = client.chat_postMessage(channel: channel, text: message, mrkdwn: true)
        SlackMessageLog.create!(
          user_id: user.id,
          channel: channel,
          status: 'success',
          response: response.to_h
        )
      rescue StandardError => e
        SlackMessageLog.create!(
          user_id: user.id,
          channel: channel,
          status: 'error',
          error: e.message,
          response: {
            type: e.class.name,
            slack_error: slack_error_payload(e)
          }
        )
        Rails.logger.error "[SlackDigest] Failed to post digest user_id=#{user.id}: #{e.message}"
      end
    end
  end

  private

  def build_digest_message(user)
    today = Time.zone.today
    events = CalendarEvent.where(user: user)
                          .where.not(status: 'cancelled')
                          .where(start_at: today.beginning_of_day..today.end_of_day)
                          .order(:start_at)

    weather_lines = weather_for(user)
    busy_lines = busy_blocks_for(user, today)

    return nil if events.empty? && busy_lines.empty? && (weather_lines.nil? || weather_lines.empty?)

    lines = []
    lines << "*Daily Digest — #{today.strftime('%b %d, %Y')}*"
    lines.concat(weather_lines) if weather_lines&.any?

    if events.any?
      lines << "\n*Today's Events*"
      events.each do |event|
        time = event.start_at ? event.start_at.strftime('%H:%M') : 'All day'
        lines << "• #{time} — #{event.title}"
      end
    end

    if busy_lines.any?
      lines << "\n*Busy Blocks*"
      lines.concat(busy_lines)
    end

    lines.join("\n")
  end

  def weather_for(user)
    locations = user.user_locations.where(label: ['home', 'school']).order(:label)
    if locations.empty?
      return [
        "*Weather*",
        "• Add a home/school location to enable weather."
      ]
    end

    lines = ["*Weather*"]
    locations.each do |location|
      next unless location.latitude && location.longitude

      summary = weather_client.hourly_summary(
        latitude: location.latitude,
        longitude: location.longitude,
        time_zone: location.time_zone || 'America/Los_Angeles',
        hours: [8, 13, 16, 19]
      )
      description = weather_client.describe_hourly(summary)
      next if description.to_s.strip.empty?

      label = location.label.to_s.capitalize
      lines << "• #{label}: #{description}"
    end

    return lines if lines.length > 1

    [
      "*Weather*",
      "• Add coordinates to home/school locations to enable weather."
    ]
  end

  def busy_blocks_for(user, day)
    users = [user] + User.where(active: true).where.not(id: user.id).to_a
    blocks = BusyBlock.where(user: users)
                      .where(start_at: day.beginning_of_day..day.end_of_day)
                      .order(:start_at)
    return [] if blocks.empty?

    connections = CalendarConnection.where(user: users)
    connection_by_calendar = connections.index_by(&:calendar_id)
    user_calendar_ids = connections.select { |c| c.user_id == user.id }.map(&:calendar_id)
    spouse_calendar_ids = connections.reject { |c| c.user_id == user.id }.map(&:calendar_id)
    user_emails = [user.email, user.slack_email].compact
    spouse_emails = users.reject { |u| u.id == user.id }.flat_map { |u| [u.email, u.slack_email] }.compact

    grouped = blocks.group_by(&:user_id)
    lines = []
    users.each do |target|
      next unless grouped[target.id]

      grouped[target.id].each do |block|
        start_time = block.start_at.strftime('%H:%M')
        end_time = block.end_at.strftime('%H:%M')
        label = calendar_label(
          block.calendar_id,
          connection_by_calendar,
          user_emails: user_emails,
          spouse_emails: spouse_emails,
          user_calendar_ids: user_calendar_ids,
          spouse_calendar_ids: spouse_calendar_ids
        )
        lines << "• #{start_time}-#{end_time} — #{label}"
      end
    end
    lines
  end

  def calendar_label(calendar_id, connection_by_calendar, user_emails:, spouse_emails:, user_calendar_ids:, spouse_calendar_ids:)
    return 'You' if calendar_id.present? && (user_emails.include?(calendar_id) || user_calendar_ids.include?(calendar_id))
    return 'Spouse' if calendar_id.present? && (spouse_emails.include?(calendar_id) || spouse_calendar_ids.include?(calendar_id))

    connection = connection_by_calendar[calendar_id]
    return 'You' if connection && user_calendar_ids.include?(connection.calendar_id)
    return 'Spouse' if connection && spouse_calendar_ids.include?(connection.calendar_id)

    calendar_id.to_s
  end

  def slack_user_id_for(user)
    return user.slack_user_id if user.slack_user_id.present?

    response = client.users_lookupByEmail(email: user.email)
    response&.user&.id
  rescue StandardError
    nil
  end

  def open_dm(user_id)
    response = client.conversations_open(users: user_id)
    { channel: response&.channel&.id }
  rescue StandardError => e
    {
      channel: nil,
      error: {
        type: e.class.name,
        message: e.message,
        slack_error: slack_error_payload(e)
      }
    }
  end

  def slack_error_payload(error)
    return nil unless error.respond_to?(:response)

    response = error.response
    {
      status: response&.status,
      headers: response&.headers,
      body: response&.body
    }
  rescue StandardError
    nil
  end

  def client
    @client ||= ::Slack::Web::Client.new(token: ENV.fetch('SLACK_BOT_TOKEN'))
  end

  def weather_client
    @weather_client ||= WeatherClient.new
  end
end
