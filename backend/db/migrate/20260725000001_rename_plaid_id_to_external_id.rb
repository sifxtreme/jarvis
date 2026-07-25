class RenamePlaidIdToExternalId < ActiveRecord::Migration[5.2]
  # plaid_id was the (poorly-named) generic external transaction id — it also holds Teller ids
  # and csv:<source>:... synthetic ids, not just Plaid. Rename to external_id. Data preserved.
  #
  # NOTE: rename_column auto-renames the associated index in Rails 5.2/Postgres — do NOT also
  # call rename_index (that fails: the old-named index no longer exists). Guarded so a partial/
  # re-run is safe.
  def change
    if column_exists?(:financial_transactions, :plaid_id) &&
       !column_exists?(:financial_transactions, :external_id)
      rename_column :financial_transactions, :plaid_id, :external_id
    end
  end
end
