class CreateSlackMessageLogs < ActiveRecord::Migration[5.2]
  def change
    create_table :slack_message_logs do |t|
      t.references :chat_message, foreign_key: true
      t.bigint :user_id
      t.string :channel
      t.string :thread_ts
      t.string :status, null: false, default: 'success'
      t.string :error
      t.jsonb :response, null: false, default: {}
      t.timestamps null: false
    end

    add_index :slack_message_logs, :status
    add_index :slack_message_logs, :user_id
    add_index :slack_message_logs, :channel
  end
end
