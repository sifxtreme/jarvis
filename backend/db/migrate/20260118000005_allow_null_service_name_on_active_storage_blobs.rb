class AllowNullServiceNameOnActiveStorageBlobs < ActiveRecord::Migration[5.2]
  def change
    change_column_null :active_storage_blobs, :service_name, true
  end
end
