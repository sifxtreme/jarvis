class User < ApplicationRecord
  has_many :calendar_connections, dependent: :destroy
  has_many :busy_blocks, dependent: :destroy
  has_many :calendar_events, dependent: :destroy

  validates :email, presence: true, uniqueness: true
end
