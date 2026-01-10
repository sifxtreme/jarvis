class CreateBusySyncLogs < ActiveRecord::Migration[5.2]
  def change
    create_table :busy_sync_logs do |t|
      t.references :calendar_connection, foreign_key: true
      t.references :user, foreign_key: true, null: false
      t.string :calendar_id, null: false
      t.datetime :time_min, null: false
      t.datetime :time_max, null: false
      t.string :status, null: false
      t.text :error_message
      t.jsonb :request_payload, null: false, default: {}
      t.jsonb :response_payload, null: false, default: {}
      t.datetime :started_at
      t.datetime :finished_at

      t.timestamps
    end

    add_index :busy_sync_logs, :calendar_id
    add_index :busy_sync_logs, :status
    add_index :busy_sync_logs, :started_at
  end
end
