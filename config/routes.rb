Rails.application.routes.draw do
  root to: 'home#index'

  get 'job', to: 'home#job'

  get 'plaid/balance/raw/:id', to: 'plaid#raw_balance'
  get 'plaid/transactions/raw/:id', to: 'plaid#raw_transactions'
  get 'plaid/balance/:id', to: 'plaid#balance'
  get 'plaid/transactions/:id', to: 'plaid#transactions'

  mount Resque::Server, :at => "/resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
