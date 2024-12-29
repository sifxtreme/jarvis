class Budget < ApplicationRecord

  has_paper_trail

  # Add validations
  validates :name, presence: true
  validates :valid_starting_at, presence: true
  validates :amount, presence: true
  validates :expense_type, presence: true, inclusion: { in: %w[expense income] }
end
