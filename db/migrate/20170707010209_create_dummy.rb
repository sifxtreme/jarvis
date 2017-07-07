class CreateDummy < ActiveRecord::Migration[5.1]
  def change
    create_table :dummies do |t|
      t.timestamps
    end
  end
end
