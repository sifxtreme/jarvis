class AddRoleToChatMessages < ActiveRecord::Migration[5.2]
  def change
    add_column :chat_messages, :role, :string, null: false, default: 'user'
    add_index :chat_messages, :role
  end
end
