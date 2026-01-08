class CreateTellerEnrollments < ActiveRecord::Migration[5.2]
  def change
    create_table :teller_enrollments do |t|
      t.references :user, null: false, foreign_key: true
      t.string :application_id, null: false
      t.string :enrollment_id, null: false
      t.timestamps null: false
    end

    add_index :teller_enrollments, [:user_id, :enrollment_id], unique: true
    add_index :teller_enrollments, :enrollment_id
  end
end
