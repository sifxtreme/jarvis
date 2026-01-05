class MemoriesController < ApplicationController
  include Rails.application.routes.url_helpers
  def index
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    memories = Memory.where(user: user)
    memories = memories.where(status: params[:status]) if params[:status].present?
    memories = memories.where(category: params[:category]) if params[:category].present?

    if params[:date].present?
      date = Date.parse(params[:date]) rescue nil
      if date
        memories = memories.where("relevant_date = ? OR relevant_date IS NULL", date)
      end
    end

    memories = memories.order(created_at: :desc).limit((params[:limit] || 200).to_i.clamp(1, 500))

    render json: { memories: memories.map { |memory| serialize(memory) } }
  end

  def create
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    data = params.permit(:content, :category, :source, :status, :image, metadata: {})
    memory = Memory.create!(
      user: user,
      content: data[:content],
      category: data[:category],
      source: data[:source],
      status: data[:status],
      metadata: data[:metadata] || {}
    )
    memory.image.attach(data[:image]) if data[:image].present?

    render json: { memory: serialize(memory) }
  end

  def destroy
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    memory = Memory.find_by(id: params[:id], user: user)
    return render json: { error: 'Not found' }, status: :not_found unless memory

    memory.destroy!
    render json: { success: true }
  end

  private

  def serialize(memory)
    {
      id: memory.id,
      content: memory.content,
      category: memory.category,
      source: memory.source,
      status: memory.status,
      image_url: image_url(memory),
      metadata: memory.metadata,
      created_at: memory.created_at&.iso8601
    }.compact
  end

  def image_url(memory)
    return nil unless memory.image.attached?

    rails_blob_path(memory.image, only_path: true)
  end
end
