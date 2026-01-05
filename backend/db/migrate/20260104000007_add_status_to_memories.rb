class AddStatusToMemories < ActiveRecord::Migration[5.2]
  def change
    add_column :memories, :status, :string, null: false, default: 'active'
    add_index :memories, :status
  end
end
