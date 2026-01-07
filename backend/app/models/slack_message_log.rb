class SlackMessageLog < ApplicationRecord
  belongs_to :chat_message, optional: true

  validates :status, presence: true
end
