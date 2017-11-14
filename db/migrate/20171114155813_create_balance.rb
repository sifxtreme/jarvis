class CreateBalance < ActiveRecord::Migration[5.1]
  def change
    create_table :plaid_balances do |t|
      t.string :bank_name, null: false, index: true
      t.string :card_name, null: false, index: true
      t.decimal :current_balance, :precision => 8, :scale => 2, null: false
      t.decimal :pending_balance, :precision => 8, :scale => 2, null: false

      t.timestamps
    end

    add_index :plaid_balances, :created_at
  end
end
