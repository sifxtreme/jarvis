class BusyBlock < ApplicationRecord
  belongs_to :user

  validates :calendar_id, :start_at, :end_at, presence: true
end
