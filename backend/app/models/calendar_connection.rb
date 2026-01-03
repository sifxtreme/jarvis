class CalendarConnection < ApplicationRecord
  belongs_to :user

  validates :calendar_id, presence: true
end
