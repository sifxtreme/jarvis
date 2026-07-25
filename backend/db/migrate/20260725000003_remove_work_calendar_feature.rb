class RemoveWorkCalendarFeature < ActiveRecord::Migration[5.2]
  # "No more busy blocks; stop reading Asif + Hafsa's work calendars." (Asif 2026-07-25)
  # Deletes the busy_only work-calendar connections (Asif's 776 cal, Hafsa's GoodRx cal) so they
  # stop syncing, and drops the feature tables. Personal calendar sync/CRUD/UI is untouched.
  # user_locations/weather were only used by the removed Slack digest.
  # The busy_only column on calendar_connections is left as a harmless vestige.
  def up
    execute "DELETE FROM calendar_connections WHERE busy_only = true"
    drop_table :busy_blocks, if_exists: true
    drop_table :busy_sync_logs, if_exists: true
    drop_table :user_locations, if_exists: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
