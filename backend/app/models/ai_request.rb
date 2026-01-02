class AiRequest < ApplicationRecord
  belongs_to :chat_message, optional: true

  validates :transport, :model, :request_kind, presence: true
end
