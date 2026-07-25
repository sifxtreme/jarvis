class RetireTeller < ActiveRecord::Migration[5.2]
  # Teller retired 2026-07-25 — Amex is on Plaid, Chase is on CSV. No live Teller source.
  # Deactivate the frozen Teller connections (id 7 hafsa_chase; id 8 amex already inactive)
  # and drop the Teller-only enrollments table. Historical hafsa_chase transactions are
  # untouched (they live in financial_transactions). update_all skips model validations.
  def up
    BankConnection.where(provider: 'teller').update_all(is_active: false)
    drop_table :teller_enrollments, if_exists: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
