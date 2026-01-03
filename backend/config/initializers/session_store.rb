Rails.application.config.session_store(
  :cookie_store,
  key: '_jarvis_session',
  domain: '.sifxtre.me',
  secure: true,
  same_site: :none
)
