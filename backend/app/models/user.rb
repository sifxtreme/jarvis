class User < ApplicationRecord
  has_many :calendar_connections, dependent: :destroy
  has_many :busy_blocks, dependent: :destroy
  has_many :calendar_events, dependent: :destroy
  has_many :chat_threads, dependent: :destroy
  has_many :memories, dependent: :destroy
  has_many :user_locations, dependent: :destroy

  validates :email, presence: true, uniqueness: true
end
