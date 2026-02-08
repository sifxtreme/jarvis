class SlackWeeklyReport
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

        blocks = build_weekly_blocks(user)
        if blocks.empty?
          SlackMessageLog.create!(
            user_id: user.id,
            channel: channel,
            status: 'skipped',
            error: 'empty_weekly_report',
            response: {}
          )
          next
        end

        week_start = Time.zone.today.next_occurring(:monday)
        response = client.chat_postMessage(
          channel: channel,
          text: "Weekly Report — Week of #{week_start.strftime('%b %d, %Y')}",
          blocks: blocks
        )
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
        Rails.logger.error "[SlackWeeklyReport] Failed for user_id=#{user.id}: #{e.message}"
      end
    end
  end

  private

  def build_weekly_blocks(user)
    week_start = Time.zone.today.next_occurring(:monday)
    week_end = week_start + 6.days
    blocks = []

    blocks << {
      type: "header",
      text: {
        type: "plain_text",
        text: "Weekly Preview — #{week_start.strftime('%b %d')} to #{week_end.strftime('%b %d')}",
        emoji: true
      }
    }

    # Gather all users for cross-referencing
    all_users = User.where(active: true).to_a
    other_users = all_users.reject { |u| u.id == user.id }

    # Your events
    your_events = CalendarEvent.where(user: user)
                               .where.not(status: 'cancelled')
                               .where(start_at: week_start.beginning_of_day..week_end.end_of_day)
                               .order(:start_at)

    # Spouse events
    spouse_events = CalendarEvent.where(user: other_users)
                                 .where.not(status: 'cancelled')
                                 .where(start_at: week_start.beginning_of_day..week_end.end_of_day)
                                 .order(:start_at)

    has_events = your_events.any? || spouse_events.any?
    return [] unless has_events

    # Build day-by-day breakdown
    (0..6).each do |offset|
      day = week_start + offset.days
      day_range = day.beginning_of_day..day.end_of_day

      your_day = your_events.select { |e| day_range.cover?(e.start_at) }
      spouse_day = spouse_events.select { |e| day_range.cover?(e.start_at) }

      next if your_day.empty? && spouse_day.empty?

      blocks << { type: "divider" }

      day_label = day.strftime('%A, %b %d')
      lines = ["*#{day_label}*"]

      if your_day.any?
        your_day.each do |event|
          time = format_event_time(event)
          lines << "  `#{time}` #{event.title}"
        end
      end

      if spouse_day.any?
        spouse_name = other_users.first&.email&.split('@')&.first&.capitalize || "Spouse"
        spouse_day.each do |event|
          time = format_event_time(event)
          lines << "  `#{time}` #{event.title} _(#{spouse_name})_"
        end
      end

      blocks << {
        type: "section",
        text: {
          type: "mrkdwn",
          text: lines.join("\n")
        }
      }
    end

    # Summary section
    blocks << { type: "divider" }
    total = your_events.size + spouse_events.size
    blocks << {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "#{total} events across the week — #{your_events.size} yours, #{spouse_events.size} spouse's"
        }
      ]
    }

    blocks
  end

  def format_event_time(event)
    if event.start_at && event.end_at && (event.end_at - event.start_at) >= 86400
      "All day"
    elsif event.start_at
      event.start_at.strftime('%l:%M %p').strip
    else
      "TBD"
    end
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
end
