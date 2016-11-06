Rails.application.routes.draw do

  resources :transactions, only: [:index] do
    collection do
      get 'batch_upload'
    end
  end

end
