class CreateChatThreads < ActiveRecord::Migration[5.2]
  def change
    create_table :chat_threads do |t|
      t.references :user, null: false, foreign_key: true
      t.string :transport, null: false
      t.string :thread_id, null: false
      t.jsonb :state, null: false, default: {}
      t.timestamps null: false

      t.index [:user_id, :transport, :thread_id], unique: true
    end
  end
end
