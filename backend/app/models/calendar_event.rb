class CalendarEvent < ApplicationRecord
  belongs_to :user

  validates :calendar_id, :event_id, presence: true
end
