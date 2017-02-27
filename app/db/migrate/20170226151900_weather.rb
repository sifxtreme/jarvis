class Weather < ActiveRecord::Migration[5.0]
  def change
    create_table :weathers do |t|
      t.string :city, index: true
      t.datetime :date
      t.text :search_data
    end
  end
end
