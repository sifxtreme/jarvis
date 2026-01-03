class ChatMessagesController < ApplicationController
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
    return render json: { error: 'Text is required' }, status: :unprocessable_entity if text.empty?

    thread_id = "web-#{user.id}"
    user_message = ChatMessage.create!(
      transport: 'web',
      external_id: user.id.to_s,
      thread_id: thread_id,
      sender_id: user.id.to_s,
      sender_email: user.email,
      text: text,
      has_image: false,
      role: 'user',
      raw_payload: { text: text }
    )

    response = WebChatMessageHandler.new(user: user, message: user_message, text: text).process!
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
      reply: serialize(assistant_message).merge(event_created: response[:event_created])
    }
  rescue StandardError => e
    Rails.logger.error "[Chat] Failed to process message: #{e.message}"
    render json: { error: e.message }, status: :internal_server_error
  end

  private

  def serialize(message)
    {
      id: message.id,
      role: message.role,
      text: message.text,
      created_at: message.created_at&.iso8601
    }
  end
end
