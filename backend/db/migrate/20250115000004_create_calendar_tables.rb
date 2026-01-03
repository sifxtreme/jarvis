class CreateCalendarTables < ActiveRecord::Migration[5.2]
  def change
    create_table :calendar_connections do |t|
      t.references :user, foreign_key: true
      t.string :calendar_id, null: false
      t.string :summary
      t.string :access_role
      t.boolean :busy_only, null: false, default: false
      t.boolean :sync_enabled, null: false, default: true
      t.boolean :primary, null: false, default: false
      t.string :time_zone
      t.string :source, null: false, default: 'google'
      t.datetime :last_synced_at

      t.timestamps
    end

    add_index :calendar_connections, [:user_id, :calendar_id], unique: true

    create_table :busy_blocks do |t|
      t.references :user, foreign_key: true
      t.string :calendar_id, null: false
      t.datetime :start_at, null: false
      t.datetime :end_at, null: false
      t.string :source, null: false, default: 'google_freebusy'

      t.timestamps
    end

    add_index :busy_blocks, [:user_id, :calendar_id]
    add_index :busy_blocks, [:start_at, :end_at]

    create_table :calendar_events do |t|
      t.references :user, foreign_key: true
      t.string :calendar_id, null: false
      t.string :event_id, null: false
      t.string :title
      t.text :description
      t.string :location
      t.datetime :start_at
      t.datetime :end_at
      t.jsonb :attendees, null: false, default: []
      t.jsonb :raw_event, null: false, default: {}
      t.string :source, null: false, default: 'slack'

      t.timestamps
    end

    add_index :calendar_events, [:user_id, :event_id], unique: true
  end
end
