class CreateCalendarAuthLogs < ActiveRecord::Migration[5.2]
  def change
    create_table :calendar_auth_logs do |t|
      t.references :user, foreign_key: true
      t.string :calendar_id
      t.string :source, null: false
      t.string :error_code
      t.text :error_message
      t.string :token_fingerprint
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :calendar_auth_logs, :source
    add_index :calendar_auth_logs, :calendar_id
    add_index :calendar_auth_logs, :token_fingerprint
  end
end
