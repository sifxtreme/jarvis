class ChatAction < ApplicationRecord
  belongs_to :chat_message
  belongs_to :calendar_event, optional: true

  validates :transport, :action_type, :status, presence: true
end
