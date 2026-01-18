class DeduplicateBusyBlocksAndAddUniqueIndex < ActiveRecord::Migration[5.2]
  disable_ddl_transaction!

  def up
    execute <<~SQL
      DELETE FROM busy_blocks a
      USING busy_blocks b
      WHERE a.id > b.id
        AND a.calendar_id = b.calendar_id
        AND a.start_at = b.start_at
        AND a.end_at = b.end_at;
    SQL

    add_index :busy_blocks,
              [:calendar_id, :start_at, :end_at],
              unique: true,
              algorithm: :concurrently,
              name: 'index_busy_blocks_on_calendar_time_unique'
  end

  def down
    remove_index :busy_blocks, name: 'index_busy_blocks_on_calendar_time_unique'
  end
end
