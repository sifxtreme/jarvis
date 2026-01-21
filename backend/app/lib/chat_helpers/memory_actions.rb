module ChatHelpers
  module MemoryActions
    def create_memory(data)
      memory = Memory.create!(
        user: @user,
        content: data['content'],
        category: data['category'],
        source: 'chat',
        status: ChatConstants::RecordStatus::ACTIVE,
        metadata: memory_metadata(data)
      )
      attach_memory_image(memory)

      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: ChatConstants::Status::SUCCESS, action_type: ChatConstants::ActionType::CREATE_MEMORY, metadata: { memory_id: memory.id })
      build_response("Saved that memory. ✅", action: 'memory_created')
    rescue StandardError => e
      log_action(@message, calendar_event_id: nil, calendar_id: nil, status: ChatConstants::Status::ERROR, action_type: ChatConstants::ActionType::CREATE_MEMORY, metadata: { error: e.message })
      build_response("Memory error: #{e.message}")
    end

    def search_memories(query_text)
      memories = Memory.where(user: @user, status: ChatConstants::RecordStatus::ACTIVE)

      terms = query_text.to_s.split(/\s+/).map(&:strip).reject(&:empty?)
      terms.each do |term|
        memories = memories.where("content ILIKE ? OR category ILIKE ?", "%#{term}%", "%#{term}%")
      end

      memories.order(created_at: :desc).limit(10).map do |memory|
        {
          content: memory.content,
          category: memory.category,
          urls: memory.metadata['urls']
        }
      end
    end

    def missing_memory_fields(memory)
      missing = []
      missing << 'content' if memory['content'].to_s.strip.empty?
      missing
    end

    def memory_metadata(data)
      metadata = (data['metadata'] || {}).dup
      urls = Array(data['urls']).map(&:to_s).map(&:strip).reject(&:empty?)
      metadata['urls'] = urls if urls.any?
      metadata['chat_message_id'] = @message.id
      metadata
    end

    def attach_memory_image(memory)
      return unless image_attached?

      memory.image.attach(@message.image.blob)
    end
  end
end
