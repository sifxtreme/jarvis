class AddCalendarIndexes < ActiveRecord::Migration[5.2]
  def change
    add_index :busy_blocks, [:user_id, :calendar_id, :start_at, :end_at], unique: true, name: 'index_busy_blocks_on_user_calendar_time'
    add_index :calendar_events, [:user_id, :calendar_id, :start_at], name: 'index_calendar_events_on_user_calendar_start'
    add_index :calendar_connections, [:sync_enabled, :busy_only], name: 'index_calendar_connections_on_sync_flags'
  end
end
