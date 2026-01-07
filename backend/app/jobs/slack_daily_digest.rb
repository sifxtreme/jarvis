class SlackDailyDigest
  def self.perform
    new.perform
  end

  def perform
    User.where(active: true).find_each do |user|
      begin
        channel = nil
        slack_id = slack_user_id_for(user)
        next if slack_id.to_s.empty?

        channel = open_dm(slack_id)
        next if channel.to_s.empty?

        message = build_digest_message(user)
        next if message.to_s.strip.empty?

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
          response: {}
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

    return nil if events.empty? && (weather_lines.nil? || weather_lines.empty?)

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

    lines.join("\n")
  end

  def weather_for(user)
    locations = user.user_locations.where(label: ['home', 'school']).order(:label)
    return nil if locations.empty?

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

    lines.length > 1 ? lines : nil
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
    response&.channel&.id
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
