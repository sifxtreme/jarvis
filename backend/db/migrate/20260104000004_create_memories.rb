class CreateMemories < ActiveRecord::Migration[5.2]
  def change
    create_table :memories do |t|
      t.references :user, null: false, foreign_key: true
      t.text :content, null: false
      t.string :category
      t.string :source
      t.date :relevant_date
      t.date :expiry_date
      t.jsonb :metadata, null: false, default: {}
      t.timestamps null: false
    end

    add_index :memories, :category
    add_index :memories, :relevant_date
  end
end
