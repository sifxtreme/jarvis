class DropOrphanedFeatureTables < ActiveRecord::Migration[5.2]
  # Tables left behind by features removed 2026-07-25 (chat, Slack, Memory, TestJobX).
  # Their models + code are already gone. Meaningful data was archived to
  # cerebro-prds/personal/ (local-only): memories + the 373 chat_messages.
  # dummies alone was 263k junk rows (empty row every 5 min from the old TestJobX).
  # Dropped in FK-dependency order (referencing tables before the referenced ones).
  def up
    drop_table :ai_requests, if_exists: true          # FK -> chat_messages
    drop_table :chat_actions, if_exists: true         # FK -> chat_messages, calendar_events (kept)
    drop_table :slack_message_logs, if_exists: true   # FK -> chat_messages
    drop_table :chat_messages, if_exists: true
    drop_table :chat_threads, if_exists: true          # FK -> users (kept)
    drop_table :memories, if_exists: true
    drop_table :dummies, if_exists: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
