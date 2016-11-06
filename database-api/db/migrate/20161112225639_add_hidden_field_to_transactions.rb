class AddHiddenFieldToTransactions < ActiveRecord::Migration[5.0]
  def change
    change_table :financial_transactions do |t|
      t.boolean :hidden, :default => false
      t.boolean :uploaded, :default => false
    end
  end
end
