require 'net/http'
require 'json'

class WeatherClient
  API_BASE = 'https://api.open-meteo.com/v1/forecast'

  def daily_summary(latitude:, longitude:, time_zone: 'America/Los_Angeles')
    uri = URI(API_BASE)
    uri.query = URI.encode_www_form(
      latitude: latitude,
      longitude: longitude,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode',
      timezone: time_zone
    )

    response = Net::HTTP.get_response(uri)
    raise "Weather request failed: #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    payload = JSON.parse(response.body)
    daily = payload['daily'] || {}
    {
      date: Array(daily['time']).first,
      temp_max: Array(daily['temperature_2m_max']).first,
      temp_min: Array(daily['temperature_2m_min']).first,
      precip: Array(daily['precipitation_probability_max']).first,
      weather_code: Array(daily['weathercode']).first
    }
  rescue StandardError => e
    Rails.logger.error("[Weather] #{e.message}")
    nil
  end

  def hourly_summary(latitude:, longitude:, time_zone: 'America/Los_Angeles', hours: [8, 13, 16, 19])
    uri = URI(API_BASE)
    uri.query = URI.encode_www_form(
      latitude: latitude,
      longitude: longitude,
      hourly: 'temperature_2m,precipitation_probability,weathercode',
      temperature_unit: 'fahrenheit',
      timezone: time_zone
    )

    response = Net::HTTP.get_response(uri)
    raise "Weather request failed: #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    payload = JSON.parse(response.body)
    hourly = payload['hourly'] || {}
    times = Array(hourly['time'])
    temps = Array(hourly['temperature_2m'])
    precips = Array(hourly['precipitation_probability'])
    codes = Array(hourly['weathercode'])

    today = Time.zone.today
    desired = hours.each_with_object({}) { |hour, acc| acc[hour] = nil }

    times.each_with_index do |time_str, idx|
      time = Time.zone.parse(time_str) rescue nil
      next unless time
      next unless time.to_date == today
      next unless desired.key?(time.hour)
      desired[time.hour] ||= {
        hour: time.hour,
        temp: temps[idx],
        precip: precips[idx],
        code: codes[idx]
      }
    end

    desired
  rescue StandardError => e
    Rails.logger.error("[Weather] #{e.message}")
    nil
  end

  def describe(summary)
    return nil unless summary

    parts = []
    if summary[:temp_max] && summary[:temp_min]
      parts << "High #{summary[:temp_max]}° / Low #{summary[:temp_min]}°"
    end
    parts << "Precip #{summary[:precip]}%" if summary[:precip]
    parts.compact.join(' · ')
  end

  def describe_hourly(summary)
    return nil unless summary

    summary.map do |hour, data|
      next unless data
      label = format_hour(hour)
      temp = data[:temp] ? "#{data[:temp].round}°F" : "—"
      emoji = weather_emoji(data[:code])
      precip = data[:precip] ? "#{data[:precip]}%" : nil
      pieces = [label, "#{temp}#{emoji}"]
      pieces << "☔️#{precip}" if data[:precip].to_f >= 10
      pieces.join(' ')
    end.compact.join("\n")
  end

  def format_hour(hour)
    hour == 0 ? "12a" : (hour < 12 ? "#{hour}a" : "#{hour == 12 ? 12 : hour - 12}p")
  end

  def weather_emoji(code)
    return "☀️" if code == 0
    return "🌤️" if [1, 2].include?(code)
    return "☁️" if code == 3
    return "🌫️" if [45, 48].include?(code)
    return "🌦️" if code.between?(51, 67)
    return "❄️" if code.between?(71, 77)
    return "🌧️" if code.between?(80, 82)
    return "⛈️" if [95, 96, 99].include?(code)
    "🌡️"
  end
end
