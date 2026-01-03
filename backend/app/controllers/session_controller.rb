class SessionController < ActionController::API
  include ActionController::Cookies
  include GoogleAuth

  def create
    token = params[:id_token].to_s
    authenticate_google_token!(token)
    return if performed?

    session[:user_email] = @current_user_email
    render json: { success: true }
  end

  def destroy
    reset_session
    render json: { success: true }
  end
end
