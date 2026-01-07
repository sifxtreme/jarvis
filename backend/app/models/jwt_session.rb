class JwtSession < ApplicationRecord
  validates :jti, :email, :expires_at, presence: true

  scope :active, -> { where(revoked_at: nil).where('expires_at > ?', Time.current) }
end
