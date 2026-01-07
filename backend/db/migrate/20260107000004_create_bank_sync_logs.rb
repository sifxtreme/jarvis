class CreateBankSyncLogs < ActiveRecord::Migration[5.2]
  def change
    create_table :bank_sync_logs do |t|
      t.references :bank_connection, null: false, foreign_key: true
      t.string :provider, null: false
      t.string :status, null: false
      t.string :error
      t.integer :fetched_count, null: false, default: 0
      t.integer :filtered_count, null: false, default: 0
      t.integer :inserted_count, null: false, default: 0
      t.integer :updated_count, null: false, default: 0
      t.date :latest_transaction_date
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps null: false
    end

    add_index :bank_sync_logs, :provider
    add_index :bank_sync_logs, :status
    add_index :bank_sync_logs, :bank_connection_id
    add_index :bank_sync_logs, :latest_transaction_date
  end
end
