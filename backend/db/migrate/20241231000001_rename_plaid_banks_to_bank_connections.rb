class RenamePlaidBanksToBankConnections < ActiveRecord::Migration[5.2]
  def change
    # Rename the table
    rename_table :plaid_banks, :bank_connections

    # Add provider column to distinguish between teller and plaid
    add_column :bank_connections, :provider, :string, default: 'plaid', null: false

    # Add account_id column for Teller (stores the acc_xxx id)
    add_column :bank_connections, :account_id, :string

    # Add sync_from_date - only sync transactions after this date (nullable)
    add_column :bank_connections, :sync_from_date, :date

    # Add index on provider for filtering
    add_index :bank_connections, :provider
  end
end
