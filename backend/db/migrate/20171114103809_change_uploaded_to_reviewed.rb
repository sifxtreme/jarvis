class ChangeUploadedToReviewed < ActiveRecord::Migration[5.1]
  def change
    remove_column :financial_transactions, :downloaded
    rename_column :financial_transactions, :uploaded, :reviewed
    rename_column :financial_transactions, :spreadsheet_name, :merchant_name
  end
end
