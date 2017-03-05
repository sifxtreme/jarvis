class AddDownloadedColumn < ActiveRecord::Migration[5.0]
  def change
    add_column :financial_transactions, :downloaded, :boolean, default: 0
  end
end
