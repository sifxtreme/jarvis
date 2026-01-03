class AddStatusToCalendarEvents < ActiveRecord::Migration[5.2]
  def change
    add_column :calendar_events, :status, :string, null: false, default: 'active'
    add_index :calendar_events, :status
  end
end
