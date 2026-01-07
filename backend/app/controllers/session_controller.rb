class SessionController < ActionController::API
  include ActionController::Cookies
  include GoogleAuth
  include JwtAuth

  def create
    token = params[:id_token].to_s
    authenticate_google_token!(token)
    return if performed?

    jwt = issue_jwt(@current_user_email)
    render json: {
      token: jwt[:token],
      expires_at: Time.at(jwt[:exp]).iso8601
    }
  end

  def show
    token = bearer_token
    payload = token.present? ? decode_jwt(token) : nil
    if payload && allowed_emails.include?(payload['sub'])
      render json: { authenticated: true, email: payload['sub'] }
      return
    end

    render json: { authenticated: false }, status: :unauthorized
  end

  def destroy
    token = bearer_token
    revoke_jwt(token) if token.present?
    render json: { success: true }
  end
end
