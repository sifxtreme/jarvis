Rails.application.routes.draw do
  root to: 'home#index'

  resources :financial_transactions, only: [:index, :create, :update] do
    collection do
      get :trends
    end
  end

  resources :budgets, only: [:index]

  # Teller API utilities
  get 'teller/accounts', to: 'teller#accounts'

  mount Resque::Server, :at => "resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
