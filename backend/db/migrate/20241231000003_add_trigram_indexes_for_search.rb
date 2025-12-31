class AddTrigramIndexesForSearch < ActiveRecord::Migration[5.2]
  def up
    # Enable pg_trgm extension for fuzzy text search
    enable_extension 'pg_trgm'

    # Add trigram indexes for ILIKE searches
    execute <<-SQL
      CREATE INDEX idx_ft_merchant_trgm ON financial_transactions
      USING GIN (merchant_name gin_trgm_ops);
    SQL

    execute <<-SQL
      CREATE INDEX idx_ft_plaid_name_trgm ON financial_transactions
      USING GIN (plaid_name gin_trgm_ops);
    SQL

    execute <<-SQL
      CREATE INDEX idx_ft_category_trgm ON financial_transactions
      USING GIN (category gin_trgm_ops);
    SQL
  end

  def down
    execute 'DROP INDEX IF EXISTS idx_ft_merchant_trgm'
    execute 'DROP INDEX IF EXISTS idx_ft_plaid_name_trgm'
    execute 'DROP INDEX IF EXISTS idx_ft_category_trgm'
    disable_extension 'pg_trgm'
  end
end
