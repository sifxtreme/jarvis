Rails.application.routes.draw do
  root to: 'home#index'
  
  get 'plaid/balances', to: 'plaid#balances'
  get 'plaid/transactions/:bank_id', to: 'plaid#transactions'
  

  get 'finances/rolling_budget', to: 'finances#rolling_budget'
  get 'finances/transactions', to: 'finances#transactions'
  get 'finances/balances', to: 'finances#balances'

  mount Resque::Server, :at => "resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
