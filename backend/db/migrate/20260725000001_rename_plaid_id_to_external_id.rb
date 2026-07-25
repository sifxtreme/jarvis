class RenamePlaidIdToExternalId < ActiveRecord::Migration[5.2]
  # plaid_id was the (poorly-named) generic external transaction id — it also holds Teller ids
  # and csv:<source>:... synthetic ids, not just Plaid. Rename to external_id. Data preserved.
  def change
    rename_column :financial_transactions, :plaid_id, :external_id
    rename_index :financial_transactions,
                 'index_financial_transactions_on_plaid_id',
                 'index_financial_transactions_on_external_id'
  end
end
