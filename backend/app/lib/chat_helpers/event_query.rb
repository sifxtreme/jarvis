module ChatHelpers
  module EventQuery
    def fallback_list_title(title)
      return title unless title.to_s.strip.empty?

      tokens = extract_query_tokens(@text)
      tokens.join(' ')
    end

    def extract_query_tokens(text)
      cleaned = text.to_s.downcase
      cleaned = cleaned.gsub(/[^a-z0-9\s]/, ' ')
      cleaned = cleaned.gsub(/\b(when|what|next|upcoming|event|events|find|show|list|the|a|an|is|are|me|please|for|today|tonight|tomorrow|this|morning|afternoon|evening)\b/, ' ')
      tokens = cleaned.split(/\s+/).reject(&:empty?)
      tokens.map { |token| normalize_token(token) }.uniq
    end

    def normalize_token(token)
      return 'swim' if token == 'swimming'
      return 'swim' if token == 'swim'
      return token.sub(/ing$/, '') if token.length > 4 && token.end_with?('ing')
      token
    end

    def apply_title_filters(scope, title)
      tokens = extract_query_tokens(title)
      tokens.reduce(scope) do |rel, token|
        rel.where("title ILIKE ?", "%#{token}%")
      end
    end

    def find_event_candidates(query)
      title = query['title'].to_s.strip
      date = query['date'].to_s.strip
      time = query['start_time'].to_s.strip

      return [] if title.empty? && date.empty?

      scope = CalendarEvent.where(user: @user).where.not(status: ChatConstants::RecordStatus::CANCELLED)
      if date.present?
        day = Date.parse(date) rescue nil
        if day
          zone = la_now.time_zone
          scope = scope.where(start_at: day.in_time_zone(zone).beginning_of_day..day.in_time_zone(zone).end_of_day)
        end
      else
        start_at = la_today - CALENDAR_WINDOW_PAST_DAYS.days
        end_at = la_today + CALENDAR_WINDOW_FUTURE_DAYS.days
        scope = scope.where(start_at: start_at.beginning_of_day..end_at.end_of_day)
      end

      events = scope.limit(50).to_a
      normalized_query = normalize_title(title)
      query_tokens = tokenize_title(title)
      scored = events.map do |event|
        event_title = event.title.to_s
        normalized_event = normalize_title(event_title)
        event_tokens = tokenize_title(event_title)
        score = 0
        if normalized_query.present?
          score += 5 if normalized_event == normalized_query
          score += 3 if normalized_event.include?(normalized_query)
          overlap = (event_tokens & query_tokens).length
          coverage = query_tokens.empty? ? 0 : overlap.to_f / query_tokens.length
          score += overlap
          score += (coverage * 3).round
        end
        if date.present? && event.start_at
          begin
            target_date = Date.parse(date)
            score += 3 if event.start_at.to_date == target_date
          rescue ArgumentError
          end
        end
        if time.present? && event.start_at
          zone = la_now.time_zone
          target_time = zone.parse("#{event.start_at.to_date} #{time}") rescue nil
          if target_time
            diff = (event.start_at - target_time).abs
            score += 2 if diff <= 60.minutes
            score += 1 if diff <= 15.minutes
          end
        end
        distance = event.start_at ? (event.start_at - la_now).abs : 10.years
        { event: event, score: score, distance: distance }
      end

      scored.select { |entry| entry[:score] > 0 }
        .sort_by { |entry| [-entry[:score], entry[:distance]] }
    end

    def find_event_candidates_with_fallback(query)
      candidates = find_event_candidates(query)
      return candidates if candidates.any?

      title = query['title'].to_s.strip
      return [] if title.empty?

      relaxed = query.dup
      relaxed.delete('date')
      relaxed.delete('start_time')
      candidates = find_event_candidates(relaxed)
      return candidates if candidates.any?

      fuzzy_event_candidates(title)
    end

    def fuzzy_event_candidates(title)
      return [] if title.to_s.strip.empty?

      start_at = la_today - CALENDAR_WINDOW_PAST_DAYS.days
      end_at = la_today + CALENDAR_WINDOW_FUTURE_DAYS.days
      quoted_title = ActiveRecord::Base.connection.quote(title)

      scope = CalendarEvent.where(user: @user)
                           .where.not(status: ChatConstants::RecordStatus::CANCELLED)
                           .where(start_at: start_at.beginning_of_day..end_at.end_of_day)
      results = scope
                .select("calendar_events.*, similarity(title, #{quoted_title}) AS similarity_score")
                .where("similarity(title, #{quoted_title}) > 0.2")
                .order(Arel.sql("similarity(title, #{quoted_title}) DESC"))
                .limit(10)
                .to_a

      results.map do |event|
        similarity = event.respond_to?(:similarity_score) ? event.similarity_score.to_f : 0
        distance = event.start_at ? (event.start_at - la_now).abs : 10.years
        { event: event, score: (similarity * 10).round(2), distance: distance }
      end
    end

    def serialize_candidates(candidates)
      candidates.map do |entry|
        event = entry[:event]
        {
          'id' => event.id,
          'title' => event.title,
          'start_at' => event.start_at&.iso8601
        }
      end
    end

    def event_snapshot(event)
      {
        id: event.id,
        event_id: event.event_id,
        title: event.title,
        start_at: event.start_at&.iso8601,
        end_at: event.end_at&.iso8601,
        calendar_id: event.calendar_id,
        updated_at: event.updated_at&.iso8601
      }
    end
  end
end
