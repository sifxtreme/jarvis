class TellerEnrollment < ApplicationRecord
  belongs_to :user

  validates :application_id, :enrollment_id, presence: true
end
