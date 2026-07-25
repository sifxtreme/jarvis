Rails.application.routes.draw do
  root to: 'home#index'

  resources :financial_transactions, only: [:index, :show, :create, :update] do
    collection do
      get :trends
      get :recurring_status
    end
  end

  resources :budgets, only: [:index]

  # Plaid API utilities (Amex via OAuth)
  post 'plaid/link_token', to: 'plaid#link_token'
  post 'plaid/exchange', to: 'plaid#exchange'

  get 'sync/status', to: 'sync_status#index'

  get 'auth/google_oauth2/callback', to: 'google_calendar_auth#callback'
  get 'auth/session', to: 'session#show'
  post 'auth/session', to: 'session#create'
  delete 'auth/session', to: 'session#destroy'
  get 'calendar/calendars', to: 'calendar#calendars'
  get 'calendar/overview', to: 'calendar#overview'
  post 'calendar/connections', to: 'calendar#upsert_connection'
  patch 'calendar/events/:id', to: 'calendar#patch_event'
  delete 'calendar/events/:id', to: 'calendar#destroy_event'

  mount Resque::Server, :at => "resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
