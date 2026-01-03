class AddSlackFieldsToUsers < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :slack_user_id, :string
    add_column :users, :slack_email, :string
    add_index :users, :slack_user_id, unique: true
  end
end
