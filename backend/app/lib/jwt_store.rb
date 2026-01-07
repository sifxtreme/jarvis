class JwtStore
  KEY_PREFIX = 'jwt:active:'.freeze

  def write(jti, ttl_seconds)
    return if jti.to_s.empty? || ttl_seconds.to_i <= 0

    redis.setex(key(jti), ttl_seconds.to_i, '1')
  end

  def valid?(jti)
    return false if jti.to_s.empty?

    redis.get(key(jti)) == '1'
  end

  def revoke(jti)
    return if jti.to_s.empty?

    redis.del(key(jti))
  end

  private

  def key(jti)
    "#{KEY_PREFIX}#{jti}"
  end

  def redis
    @redis ||= Redis.new(url: ENV.fetch('REDIS_URL', 'redis://redis:6379/0'))
  end
end
