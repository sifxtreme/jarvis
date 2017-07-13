Rails.application.routes.draw do
  root to: 'home#index'

  get 'job', to: 'home#job'

  mount Resque::Server, :at => "/resque"
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
