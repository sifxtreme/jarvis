require 'jwt'

module JwtAuth
  JWT_TTL_SECONDS = 30.days.to_i

  def issue_jwt(email)
    jti = SecureRandom.uuid
    now = Time.current.to_i
    exp = now + JWT_TTL_SECONDS
    payload = {
      sub: email,
      jti: jti,
      iat: now,
      exp: exp
    }
    token = JWT.encode(payload, jwt_secret, 'HS256')
    jwt_store.write(jti, exp - now)
    { token: token, exp: exp, jti: jti }
  end

  def decode_jwt(token)
    payload, = JWT.decode(token, jwt_secret, true, { algorithm: 'HS256' })
    return nil unless jwt_store.valid?(payload['jti'])

    payload
  rescue JWT::DecodeError
    nil
  end

  def decode_jwt_for_revoke(token)
    payload, = JWT.decode(token, jwt_secret, true, { algorithm: 'HS256', verify_expiration: false })
    payload
  rescue JWT::DecodeError
    nil
  end

  def revoke_jwt(token)
    payload = decode_jwt_for_revoke(token)
    return false unless payload && payload['jti']

    jwt_store.revoke(payload['jti'])
    true
  end

  private

  def jwt_secret
    ENV.fetch('JWT_SECRET', Rails.application.credentials.secret_key_base)
  end

  def jwt_store
    @jwt_store ||= JwtStore.new
  end
end
