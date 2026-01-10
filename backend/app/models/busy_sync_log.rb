class BusySyncLog < ApplicationRecord
  belongs_to :calendar_connection, optional: true
  belongs_to :user

  validates :calendar_id, presence: true
  validates :status, presence: true
end
