Rails.application.routes.draw do
  root to: 'home#index'

  get 'plaid/transactions/:id', to: 'plaid#transactions'
  get 'plaid/balances/:id', to: 'plaid#balance'
  get 'plaid/balances', to: 'plaid#balances'

  get 'finances/this_month', to: 'finances#this_month'
  get 'finances/last_month', to: 'finances#last_month'
  get 'finances/rolling_budget', to: 'finances#rolling_budget'
  get 'finances/transactions', to: 'finances#transactions'
  get 'finances/transactions/search', to: 'finances#search'

  mount Resque::Server, :at => "resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
