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

ActiveRecord::Schema.define(version: 20170305191241) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "financial_transactions", id: :serial, force: :cascade do |t|
    t.string "plaid_id"
    t.string "plaid_name"
    t.string "spreadsheet_name"
    t.string "category"
    t.string "source"
    t.decimal "amount", precision: 8, scale: 2
    t.datetime "transacted_at"
    t.boolean "hidden", default: false
    t.boolean "uploaded", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "downloaded", default: false
    t.index ["category"], name: "index_financial_transactions_on_category"
    t.index ["plaid_id"], name: "index_financial_transactions_on_plaid_id"
    t.index ["plaid_name"], name: "index_financial_transactions_on_plaid_name"
    t.index ["spreadsheet_name"], name: "index_financial_transactions_on_spreadsheet_name"
    t.index ["transacted_at"], name: "index_financial_transactions_on_transacted_at"
  end

  create_table "flights", id: :serial, force: :cascade do |t|
    t.string "origin"
    t.string "destination"
    t.datetime "departure_date"
    t.datetime "arrival_date"
    t.json "search_data"
    t.json "flexible_data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["destination"], name: "index_flights_on_destination"
    t.index ["origin"], name: "index_flights_on_origin"
  end

  create_table "weathers", id: :serial, force: :cascade do |t|
    t.string "city"
    t.datetime "date"
    t.text "search_data"
    t.index ["city"], name: "index_weathers_on_city"
  end

end
