class CreateJwtSessions < ActiveRecord::Migration[5.2]
  def change
    create_table :jwt_sessions do |t|
      t.string :jti, null: false
      t.string :email, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.timestamps null: false
    end

    add_index :jwt_sessions, :jti, unique: true
    add_index :jwt_sessions, :email
    add_index :jwt_sessions, :expires_at
  end
end
