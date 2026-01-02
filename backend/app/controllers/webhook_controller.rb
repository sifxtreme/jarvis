class WebhookController < ActionController::API
  # Webhooks use provider signatures instead of our auth header/CSRF.
end
