module ChatHelpers
  module MemoryHandlers
    def handle_create_memory
      flow_engine.handle_create(:memory)
    rescue StandardError => e
      build_response("Memory error: #{e.message}")
    end

    def handle_search_memory
      result = gemini.extract_memory_query_from_text(@text)
      log_ai_result(result, request_kind: 'memory_query', model: gemini_intent_model)
      query = result[:event] || {}

      if query['error'] || query['query'].to_s.strip.empty?
        return build_response(
          clarify_missing_details(
            intent: 'search_memory',
            missing_fields: ['query'],
            extracted: {},
            fallback: "What should I search for in your memories?"
          )
        )
      end

      memories = search_memories(query['query'])
      return build_response("I couldn't find any memories about that.") if memories.empty?

      answer = gemini.answer_with_memories(@text, memories)
      log_ai_text(answer[:text], usage: answer[:usage], request_kind: 'memory_answer', model: gemini_extract_model)
      build_response(answer[:text].presence || format_memory_list(memories))
    rescue StandardError => e
      build_response("Memory search error: #{e.message}")
    end
  end
end
