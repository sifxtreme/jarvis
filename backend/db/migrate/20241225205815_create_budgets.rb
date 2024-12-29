class CreateBudgets < ActiveRecord::Migration[5.2]
  def change
    create_table :budgets do |t|
      t.text :name, null: false
      t.datetime :valid_starting_at, null: false
      t.datetime :valid_ending_at
      t.decimal :amount, null: false
      t.string :expense_type, null: false

      t.timestamps
    end

    # Add a check constraint for `expense_type` enum
    execute <<-SQL
      ALTER TABLE budgets
      ADD CONSTRAINT check_expense_type
      CHECK (expense_type IN ('expense', 'income'));
    SQL
  end
end
