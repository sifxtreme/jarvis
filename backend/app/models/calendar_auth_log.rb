class CalendarAuthLog < ApplicationRecord
  belongs_to :user

  validates :source, presence: true
end
