class AddTransactionsCursorToBankConnections < ActiveRecord::Migration[5.2]
  def change
    add_column :bank_connections, :transactions_cursor, :text
  end
end
