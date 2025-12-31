class BankConnection < ApplicationRecord
  # Providers
  PROVIDER_PLAID = 'plaid'.freeze
  PROVIDER_TELLER = 'teller'.freeze

  # Validations
  validates :name, presence: true
  validates :token, presence: true
  validates :provider, presence: true, inclusion: { in: [PROVIDER_PLAID, PROVIDER_TELLER] }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :plaid, -> { where(provider: PROVIDER_PLAID) }
  scope :teller, -> { where(provider: PROVIDER_TELLER) }

  def plaid?
    provider == PROVIDER_PLAID
  end

  def teller?
    provider == PROVIDER_TELLER
  end
end
