class ChatMessage < ApplicationRecord
  has_many :ai_requests, dependent: :nullify
  has_many :chat_actions, dependent: :nullify

  validates :transport, :external_id, presence: true
end
