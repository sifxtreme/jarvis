Rails.application.routes.draw do

  resources :transactions, only: [:index, :update] do
    collection do
      post 'batch_upload'
    end
  end

end
