module ChatHelpers
  module Formatters
    def format_event(event)
      lines = []
      lines << "Title: #{event['title']}" if event['title'].present?
      lines << "Date: #{event['date']}" if event['date'].present?
      time_range = [event['start_time'], event['end_time']].compact.join(' - ')
      lines << "Time: #{time_range}" if time_range.present?
      recurrence_label = format_recurrence(event['recurrence'])
      lines << "Repeats: #{recurrence_label}" if recurrence_label
      lines << "Location: #{event['location']}" if event['location'].present?
      lines << "Details: #{event['description']}" if event['description'].present?
      lines.join("\n")
    end

    def format_recurrence(recurrence)
      return nil if recurrence.nil?

      if recurrence.is_a?(String)
        return recurrence if recurrence.strip != ''
        return nil
      end

      return nil unless recurrence.is_a?(Hash)

      freq = recurrence['frequency'].to_s
      return nil if freq.empty?

      label = freq
      days = Array(recurrence['by_day']).map(&:to_s)
      label = "#{label} on #{days.join(', ')}" if days.any?
      label
    end

    def format_event_record(event)
      [
        "Title: #{event.title}",
        (event.start_at ? "Date: #{event.start_at.to_date}" : nil),
        (event.start_at ? "Time: #{event.start_at.strftime('%-I:%M %p')}" : nil)
      ].compact.join("\n")
    end

    def format_event_brief(event)
      return event.title.to_s if event.start_at.nil?

      date_label = event.start_at.strftime('%b %d')
      time_label = event.start_at.strftime('%-I:%M %p')
      end_label = event.end_at ? event.end_at.strftime('%-I:%M %p') : nil
      time_range = end_label ? "#{time_label}-#{end_label}" : time_label
      "#{date_label} #{time_range} - #{event.title}"
    end

    def format_event_changes(event_record, changes)
      lines = []
      lines << "Title: #{changes['title'] || event_record.title}"
      date = changes['date'] || event_record.start_at&.to_date
      lines << "Date: #{date}" if date
      time = changes['start_time'] || event_record.start_at&.strftime('%-I:%M %p')
      end_time = changes['end_time']
      if end_time.to_s.empty? && changes['duration_minutes'].present? && date && time
        base_time = Time.zone.parse("#{date} #{time}")
        end_time = (base_time + changes['duration_minutes'].to_i.minutes).strftime('%-I:%M %p') if base_time
      end
      end_time = event_record.end_at&.strftime('%-I:%M %p') if end_time.to_s.empty?
      time_range = [time, end_time].compact.join(' - ')
      lines << "Time: #{time_range}" if time_range.present?
      if changes['recurrence_clear']
        lines << "Repeats: none"
      else
        recurrence_label = format_recurrence(changes['recurrence'])
        lines << "Repeats: #{recurrence_label}" if recurrence_label
      end
      if changes['location'] || event_record.location
        lines << "Location: #{changes['location'] || event_record.location}"
      end
      if changes['description'] || event_record.description
        lines << "Details: #{changes['description'] || event_record.description}"
      end
      lines.join("\n")
    end

    def format_transaction(transaction)
      lines = []
      lines << "Merchant: #{transaction['merchant']}" if transaction['merchant'].present?
      lines << "Amount: #{transaction['amount']}" if transaction['amount'].present?
      lines << "Date: #{transaction['date']}" if transaction['date'].present?
      lines << "Category: #{transaction['category']}" if transaction['category'].present?
      lines << "Source: #{transaction['source']}" if transaction['source'].present?
      lines.join("\n")
    end

    def format_memory(memory)
      lines = []
      lines << "Content: #{memory['content']}" if memory['content'].present?
      lines << "Category: #{memory['category']}" if memory['category'].present?
      if memory['urls'].is_a?(Array) && memory['urls'].any?
        lines << "Links: #{memory['urls'].join(', ')}"
      end
      lines.join("\n")
    end

    def format_memory_list(memories)
      memories.map do |memory|
        label = memory[:category] ? "[#{memory[:category]}] " : ""
        url_part = memory[:urls]&.any? ? " (#{memory[:urls].join(', ')})" : ""
        "• #{label}#{memory[:content]}#{url_part}"
      end.join("\n")
    end

    def format_candidates(candidates)
      candidates.first(5).each_with_index.map do |entry, idx|
        event = entry[:event]
        time_label = event.start_at ? event.start_at.strftime('%b %d %-I:%M %p') : 'Unknown time'
        "#{idx + 1}) #{event.title} — #{time_label}"
      end.join("\n")
    end

    def format_extracted_candidates(events)
      events.first(5).each_with_index.map do |event, idx|
        title = event['title'].presence || 'Untitled event'
        date = event['date'].presence || 'Unknown date'
        start_time = event['start_time'].presence
        end_time = event['end_time'].presence
        time_range = [start_time, end_time].compact.join('-')
        time_label = time_range.present? ? time_range : 'Unknown time'
        "#{idx + 1}) #{title} — #{date} #{time_label}"
      end.join("\n")
    end

    def format_extracted_transactions(transactions)
      transactions.first(5).each_with_index.map do |transaction, idx|
        merchant = transaction['merchant'].presence || 'Unknown merchant'
        amount = transaction['amount'].present? ? "$#{transaction['amount']}" : 'Unknown amount'
        date = transaction['date'].presence || 'Unknown date'
        source = transaction['source'].presence
        details = [merchant, amount, date, source].compact.join(' • ')
        "#{idx + 1}) #{details}"
      end.join("\n")
    end

    def format_context_line(message)
      content = message.text.to_s.strip
      content = "[image]" if content.empty? && message.has_image
      return nil if content.empty?

      content = "#{content[0, 200]}..." if content.length > 200
      label = message.role == 'assistant' ? 'Assistant' : 'User'
      "#{label}: #{content}"
    end
  end
end
