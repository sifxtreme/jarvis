Rails.application.routes.draw do
  root to: 'home#index'

  get 'plaid/balances', to: 'plaid#balances'
  get 'plaid/transactions/:bank_id', to: 'plaid#transactions'
  
  resources :financial_transactions, only: [:index, :create, :update]
  
  mount Resque::Server, :at => "resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
