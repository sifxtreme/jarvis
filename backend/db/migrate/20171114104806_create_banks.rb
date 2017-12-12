class CreateBanks < ActiveRecord::Migration[5.1]
  def change
    create_table :plaid_banks do |t|
      t.string :name, index: true, null: false
      t.string :token, null: false
    end
  end
end
