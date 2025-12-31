class AddMissingIndexesToFinancialTransactions < ActiveRecord::Migration[5.2]
  def change
    # Compound index for ORDER BY (transacted_at DESC, id DESC)
    add_index :financial_transactions, [:transacted_at, :id], order: { transacted_at: :desc, id: :desc },
              name: 'idx_financial_transactions_transacted_id'

    # Functional indexes for year/month filtering
    add_index :financial_transactions, 'EXTRACT(year FROM transacted_at)',
              name: 'idx_financial_transactions_year'
    add_index :financial_transactions, 'EXTRACT(month FROM transacted_at)',
              name: 'idx_financial_transactions_month'

    # Source column index
    add_index :financial_transactions, :source,
              name: 'idx_financial_transactions_source'

    # GIN index for amortized_months array
    add_index :financial_transactions, :amortized_months, using: :gin,
              name: 'idx_financial_transactions_amortized_months'
  end
end
