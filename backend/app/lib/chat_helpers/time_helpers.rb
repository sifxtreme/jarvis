module ChatHelpers
  module TimeHelpers
    def parse_duration_minutes(text)
      return nil if text.to_s.strip.empty?

      normalized = text.downcase
      hours_match = normalized.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr)\b/)
      if hours_match
        hours = hours_match[1].to_f
        return (hours * 60).round if hours.positive?
      end

      minutes_match = normalized.match(/(\d+)\s*(minutes?|mins?|min)\b/)
      if minutes_match
        minutes = minutes_match[1].to_i
        return minutes if minutes.positive?
      end

      nil
    end

    def parse_transaction_date(date_str)
      Date.parse(date_str)
    rescue ArgumentError
      Date.current
    end

    def la_now
      ::Time.now.in_time_zone('America/Los_Angeles')
    end

    def la_today
      la_now.to_date
    end
  end
end
