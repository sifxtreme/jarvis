class ChatThread < ApplicationRecord
  belongs_to :user

  validates :transport, :thread_id, presence: true
end
