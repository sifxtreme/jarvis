class CreateFlights < ActiveRecord::Migration[5.0]
  def change
    create_table :flights do |t|
      t.string :origin, index: true
      t.string :destination, index: true
      t.datetime :departure_date
      t.datetime :arrival_date
      t.json :search_data
      t.json :flexible_data

      t.timestamps
    end
  end
end
