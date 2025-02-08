# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 2024_12_25_211107) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "budgets", force: :cascade do |t|
    t.text "name", null: false
    t.datetime "valid_starting_at", null: false
    t.datetime "valid_ending_at"
    t.decimal "amount", null: false
    t.string "expense_type", null: false
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
    t.integer "display_order", default: 0, null: false
  end

  create_table "chat", id: :serial, force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "title", limit: 100
    t.datetime "created_at"
    t.boolean "is_auto_titled"
  end

  create_table "dummies", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "events", id: false, force: :cascade do |t|
    t.text "email"
    t.text "url"
  end

  create_table "financial_transactions", id: :serial, force: :cascade do |t|
    t.string "plaid_id", limit: 255
    t.string "plaid_name", limit: 255
    t.string "merchant_name", limit: 255
    t.string "category", limit: 255
    t.string "source", limit: 255
    t.decimal "amount", precision: 8, scale: 2
    t.datetime "transacted_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.boolean "hidden", default: false
    t.boolean "reviewed", default: false
    t.jsonb "raw_data", default: {}
    t.index ["category"], name: "index_financial_transactions_on_category"
    t.index ["hidden"], name: "financial_transactions_hidden_idx"
    t.index ["merchant_name"], name: "index_financial_transactions_on_merchant_name"
    t.index ["plaid_id"], name: "index_financial_transactions_on_plaid_id"
    t.index ["plaid_name"], name: "index_financial_transactions_on_plaid_name"
    t.index ["reviewed"], name: "financial_transactions_reviewed_idx"
    t.index ["transacted_at"], name: "index_financial_transactions_on_transacted_at"
  end

  create_table "message", id: :serial, force: :cascade do |t|
    t.integer "chat_id", null: false
    t.string "role", limit: 20, null: false
    t.text "content", null: false
    t.datetime "timestamp"
  end

  create_table "migrations", id: :serial, force: :cascade do |t|
    t.text "migration_name", null: false
    t.datetime "applied_at", default: -> { "CURRENT_TIMESTAMP" }
  end

  create_table "plaid_banks", force: :cascade do |t|
    t.string "name", limit: 255, null: false
    t.string "token", limit: 255, null: false
    t.boolean "is_active", default: false
  end

  create_table "subtitle_sets", id: :serial, force: :cascade do |t|
    t.string "original_filename", limit: 255, null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }
  end

  create_table "subtitles", id: :serial, force: :cascade do |t|
    t.integer "set_id"
    t.integer "index", null: false
    t.string "timestamp", limit: 255, null: false
    t.text "text", null: false
    t.text "translated_text"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }
  end

  create_table "user", id: :serial, force: :cascade do |t|
    t.string "username", limit: 64, null: false
    t.string "email", limit: 120, null: false
    t.string "password_hash", limit: 256
    t.index ["email"], name: "user_email_key", unique: true
    t.index ["username"], name: "user_username_key", unique: true
  end

  create_table "users", id: :serial, force: :cascade do |t|
    t.string "email", limit: 255, null: false
    t.string "password_hash", limit: 255, null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }
    t.index ["email"], name: "users_email_key", unique: true
  end

  create_table "versions", force: :cascade do |t|
    t.string "item_type", limit: 191, null: false
    t.integer "item_id", null: false
    t.string "event", limit: 255, null: false
    t.string "whodunnit", limit: 255
    t.text "object"
    t.datetime "created_at"
    t.text "object_changes"
    t.index ["item_type", "item_id"], name: "index_versions_on_item_type_and_item_id"
  end

  add_foreign_key "chat", "\"user\"", column: "user_id", name: "chat_user_id_fkey"
  add_foreign_key "message", "chat", name: "message_chat_id_fkey"
  add_foreign_key "subtitles", "subtitle_sets", column: "set_id", name: "subtitles_set_id_fkey"
end
