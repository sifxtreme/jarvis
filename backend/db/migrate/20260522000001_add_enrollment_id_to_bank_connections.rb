class AddEnrollmentIdToBankConnections < ActiveRecord::Migration[5.2]
  def change
    add_column :bank_connections, :enrollment_id, :string
    add_index :bank_connections, :enrollment_id
  end
end
