class ChatMessagesController < ApplicationController
  include Rails.application.routes.url_helpers

  def index
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    messages = ChatMessage
      .where(transport: 'web', external_id: user.id.to_s)
      .order(:created_at)
      .limit(200)

    render json: { messages: messages.map { |message| serialize(message) } }
  end

  def create
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    text = params[:text].to_s.strip
    image = params[:image]
    return render json: { error: 'Text or image is required' }, status: :unprocessable_entity if text.empty? && image.blank?

    thread_id = "web-#{user.id}"
    thread = ChatThread.find_or_create_by!(user: user, transport: 'web', thread_id: thread_id)
    user_message = ChatMessage.create!(
      transport: 'web',
      external_id: user.id.to_s,
      thread_id: thread_id,
      sender_id: user.id.to_s,
      sender_email: user.email,
      text: text,
      has_image: image.present?,
      role: 'user',
      raw_payload: { text: text }
    )
    user_message.image.attach(image) if image.present?

    response = WebChatMessageHandler.new(
      user: user,
      message: user_message,
      text: text,
      image: user_message.image,
      thread: thread
    ).process!
    assistant_message = ChatMessage.create!(
      transport: 'web',
      external_id: user.id.to_s,
      thread_id: thread_id,
      sender_id: 'assistant',
      sender_email: nil,
      text: response[:text],
      has_image: false,
      role: 'assistant',
      raw_payload: { response_to: user_message.id, event_created: response[:event_created] }
    )

    render json: {
      message: serialize(user_message),
      reply: serialize(assistant_message).merge(event_created: response[:event_created], action: response[:action])
    }
  rescue StandardError => e
    Rails.logger.error "[Chat] Failed to process message: #{e.message}"
    if defined?(user_message) && user_message
      ChatAction.create!(
        chat_message: user_message,
        calendar_event_id: nil,
        calendar_id: nil,
        transport: 'web',
        action_type: 'chat_error',
        status: 'error',
        metadata: {
          error: e.message,
          error_code: 'chat_processing_failed',
          request_id: request.request_id,
          backtrace: e.backtrace&.first(10)
        }
      )
    end
    render json: { error: e.message }, status: :internal_server_error
  end

  private

  def serialize(message)
    {
      id: message.id,
      role: message.role,
      text: message.text,
      image_url: image_url(message),
      created_at: message.created_at&.iso8601
    }.compact
  end

  def image_url(message)
    return nil unless message.image.attached?

    rails_blob_path(message.image, only_path: true)
  end
end
