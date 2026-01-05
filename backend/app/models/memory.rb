class Memory < ApplicationRecord
  belongs_to :user
  has_one_attached :image

  validates :content, presence: true
  validates :status, inclusion: { in: %w[active invalidated] }
end
