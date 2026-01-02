class ChatMessage < ApplicationRecord
  has_many :ai_requests, dependent: :nullify

  validates :transport, :external_id, presence: true
end
