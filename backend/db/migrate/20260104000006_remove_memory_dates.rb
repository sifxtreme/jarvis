class RemoveMemoryDates < ActiveRecord::Migration[5.2]
  def change
    remove_column :memories, :relevant_date, :date
    remove_column :memories, :expiry_date, :date
  end
end
