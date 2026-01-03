require 'google-id-token'

module GoogleAuth
  private

  def authenticate_google!
    token = bearer_token
    authenticate_google_token!(token)
  end

  def authenticate_google_token!(token)
    unless token
      render json: { msg: 'Unauthorized' }, status: :unauthorized
      return
    end

    payload = GoogleIDToken::Validator.new.check(token, google_client_id)
    email = payload['email']
    verified = payload['email_verified']

    unless verified && allowed_emails.include?(email)
      render json: { msg: 'Unauthorized' }, status: :unauthorized
      return
    end

    @current_user_email = email
    record_last_login(payload)
  rescue StandardError => e
    Rails.logger.tagged("AUTH") { Rails.logger.warn "Google auth failed: #{e.message}" }
    render json: { msg: 'Unauthorized' }, status: :unauthorized
  end

  def allow_google_auth?
    bearer_token.present?
  end

  def bearer_token
    auth = request.headers['Authorization'].to_s
    return nil unless auth.start_with?('Bearer ')

    auth.split(' ', 2).last
  end

  def google_client_id
    ENV.fetch('GOOGLE_OAUTH_CLIENT_ID')
  end

  def allowed_emails
    if defined?(User) && User.any?
      return User.where(active: true).pluck(:email)
    end

    list = ENV.fetch('GOOGLE_AUTH_ALLOWED_EMAILS', 'asif.h.ahmed@gmail.com,hsayyeda@gmail.com')
    list.split(',').map(&:strip).reject(&:empty?)
  end

  def record_last_login(payload)
    return unless defined?(User)

    user = User.find_or_create_by(email: payload['email']) do |record|
      record.password_hash = 'unused'
    end

    user.update(
      google_sub: payload['sub'],
      last_login_at: Time.current
    )
  end

  def current_user
    return unless defined?(User)

    User.find_by(email: @current_user_email)
  end
end
