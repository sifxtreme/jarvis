class CreateChatActions < ActiveRecord::Migration[5.2]
  def change
    create_table :chat_actions do |t|
      t.bigint :chat_message_id, null: false
      t.bigint :calendar_event_id
      t.string :calendar_id
      t.string :transport, null: false
      t.string :action_type, null: false
      t.string :status, null: false, default: 'success'
      t.jsonb :metadata, null: false, default: {}
      t.timestamps null: false
    end

    add_index :chat_actions, :chat_message_id
    add_index :chat_actions, :calendar_event_id
    add_index :chat_actions, :action_type
    add_foreign_key :chat_actions, :chat_messages
    add_foreign_key :chat_actions, :calendar_events
  end
end
