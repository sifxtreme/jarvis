class CreateChatMessagesAndAiRequests < ActiveRecord::Migration[5.2]
  def change
    create_table :chat_messages do |t|
      t.string :transport, null: false
      t.string :external_id, null: false
      t.string :thread_id
      t.string :message_ts
      t.string :sender_id
      t.text :text
      t.boolean :has_image, null: false, default: false
      t.jsonb :raw_payload, null: false, default: {}

      t.timestamps
    end

    add_index :chat_messages, [:transport, :external_id, :thread_id], name: 'index_chat_messages_on_transport_external_thread'
    add_index :chat_messages, :message_ts

    create_table :ai_requests do |t|
      t.references :chat_message, foreign_key: true
      t.string :transport, null: false
      t.string :model, null: false
      t.string :request_kind, null: false
      t.integer :prompt_tokens
      t.integer :output_tokens
      t.integer :total_tokens
      t.decimal :cost_usd, precision: 12, scale: 6
      t.string :status, null: false, default: 'success'
      t.string :error_message
      t.jsonb :usage_metadata, null: false, default: {}

      t.timestamps
    end

    add_index :ai_requests, :transport
    add_index :ai_requests, :model
  end
end
