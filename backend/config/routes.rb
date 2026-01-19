Rails.application.routes.draw do
  root to: 'home#index'

  resources :financial_transactions, only: [:index, :show, :create, :update] do
    collection do
      get :trends
      get :recurring_status
    end
  end

  resources :budgets, only: [:index]

  # Teller API utilities
  get 'teller/accounts', to: 'teller#accounts'
  get 'teller/health', to: 'teller#health'
  get 'teller/enrollment', to: 'teller_enrollments#show'
  post 'teller/enrollment', to: 'teller_enrollments#create'

  get 'chat/messages', to: 'chat_messages#index'
  post 'chat/messages', to: 'chat_messages#create'

  resources :memories, only: [:index, :create, :destroy]
  resources :user_locations, only: [:index, :create, :update, :destroy]

  post 'slack/events', to: 'slack_events#events'

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
