class CreateFinancialTransactionsTable < ActiveRecord::Migration[5.0]
  def change
    create_table :financial_transactions do |t|
      t.string :plaid_id, index: true
      t.string :plaid_name, index: true
      t.string :spreadsheet_name, index: true
      t.string :category, index: true
      t.string :source
      t.decimal :amount, :precision => 8, :scale => 2
      t.datetime :transacted_at, index: true

      t.timestamps
    end
  end
end
