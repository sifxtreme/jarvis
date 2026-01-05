class CreateUserLocations < ActiveRecord::Migration[5.2]
  def change
    create_table :user_locations do |t|
      t.references :user, null: false, foreign_key: true
      t.string :label, null: false
      t.string :address
      t.decimal :latitude, precision: 10, scale: 6
      t.decimal :longitude, precision: 10, scale: 6
      t.string :time_zone
      t.timestamps null: false
    end

    add_index :user_locations, [:user_id, :label], unique: true
  end
end
