class CreateActiveStorageAttachments < ActiveRecord::Migration[5.2]
  def change
    create_table :active_storage_attachments do |t|
      t.string     :name,     null: false
      t.references :record,   null: false, polymorphic: true, index: false
      t.references :blob,     null: false
      t.datetime   :created_at, null: false

      t.index [ :record_type, :record_id, :name, :blob_id ],
        name: "index_active_storage_attachments_uniqueness",
        unique: true
    end

    add_foreign_key :active_storage_attachments, :active_storage_blobs, column: :blob_id
  end
end
