class AddSenderEmailToChatMessages < ActiveRecord::Migration[5.2]
  def change
    add_column :chat_messages, :sender_email, :string
    add_index :chat_messages, :sender_email
  end
end
