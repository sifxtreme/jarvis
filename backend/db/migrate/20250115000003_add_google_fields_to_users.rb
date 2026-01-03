class AddGoogleFieldsToUsers < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :google_sub, :string
    add_column :users, :google_refresh_token, :string
    add_column :users, :last_login_at, :datetime
    add_column :users, :active, :boolean, null: false, default: true

    add_index :users, :google_sub, unique: true
    add_index :users, :active
  end
end
