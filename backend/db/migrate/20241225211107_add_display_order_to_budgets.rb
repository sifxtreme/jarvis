class AddDisplayOrderToBudgets < ActiveRecord::Migration[5.2]
  def change
    add_column :budgets, :display_order, :integer, default: 0, null: false
  end
end
