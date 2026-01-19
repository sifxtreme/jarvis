module ChatHelpers
  module Selection
    def auto_pick_candidate(candidates)
      return nil if candidates.length < 2

      top, second = candidates[0], candidates[1]
      top_score = top[:score].to_f
      second_score = second[:score].to_f

      return nil if top_score < 6
      return top if top_score >= second_score + 3

      nil
    end

    def selection_index_from_text(max_count)
      indices = selection_indices_from_text(max_count)
      return nil unless indices.is_a?(Array) && indices.any?
      return nil if indices == :all
      return nil unless indices.length == 1

      indices.first + 1
    end

    def selection_indices_from_text(max_count)
      text = @text.to_s.downcase
      return :all if text.match?(/\ball\b/)

      indices = []
      indices.concat(text.scan(/\b(\d+)\b/).flatten.map(&:to_i).map { |idx| idx - 1 })
      indices.concat(text.scan(/\b(\d+)(?:st|nd|rd|th)\b/).flatten.map(&:to_i).map { |idx| idx - 1 })
      indices.concat(word_selection_indices(text, max_count))
      indices.select { |idx| idx >= 0 && idx < max_count }.uniq
    end

    def word_selection_indices(text, max_count)
      indices = []
      ordinals = {
        'first' => 0,
        'second' => 1,
        'third' => 2,
        'fourth' => 3,
        'fifth' => 4
      }
      ordinals.each do |word, idx|
        indices << idx if text.match?(/\b#{word}\b/)
      end
      indices << (max_count - 1) if max_count.positive? && text.match?(/\blast\b/)
      indices
    end

    def pick_candidate(candidates)
      indices = selection_indices_from_text(candidates.length)
      if indices.is_a?(Array) && indices.length == 1
        index = indices.first
        return candidates[index] if index && index >= 0 && index < candidates.length
      end

      lowered = @text.downcase
      candidates.find { |entry| entry[:event].title.to_s.downcase.include?(lowered) }
    end
  end
end
