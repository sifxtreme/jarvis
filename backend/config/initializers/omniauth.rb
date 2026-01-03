Rails.application.config.middleware.use OmniAuth::Builder do
  provider(
    :google_oauth2,
    ENV.fetch('GOOGLE_OAUTH_CLIENT_ID'),
    ENV.fetch('GOOGLE_OAUTH_CLIENT_SECRET'),
    {
      scope: 'email profile https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent select_account',
      include_granted_scopes: 'true'
    }
  )
end

OmniAuth.config.allowed_request_methods = %i[get]
