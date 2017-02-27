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

ActiveRecord::Schema.define(version: 20170226151900) do

  create_table "financial_transactions", force: :cascade, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8" do |t|
    t.string   "plaid_id"
    t.string   "plaid_name"
    t.string   "spreadsheet_name"
    t.string   "category"
    t.string   "source"
    t.decimal  "amount",           precision: 8, scale: 2
    t.datetime "transacted_at"
    t.datetime "created_at",                                               null: false
    t.datetime "updated_at",                                               null: false
    t.boolean  "hidden",                                   default: false
    t.boolean  "uploaded",                                 default: false
    t.index ["category"], name: "index_financial_transactions_on_category", using: :btree
    t.index ["plaid_id"], name: "index_financial_transactions_on_plaid_id", using: :btree
    t.index ["plaid_name"], name: "index_financial_transactions_on_plaid_name", using: :btree
    t.index ["spreadsheet_name"], name: "index_financial_transactions_on_spreadsheet_name", using: :btree
    t.index ["transacted_at"], name: "index_financial_transactions_on_transacted_at", using: :btree
  end

  create_table "flights", force: :cascade, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8" do |t|
    t.string   "origin"
    t.string   "destination"
    t.datetime "departure_date"
    t.datetime "arrival_date"
    t.json     "search_data"
    t.json     "flexible_data"
    t.datetime "created_at",     null: false
    t.datetime "updated_at",     null: false
    t.index ["destination"], name: "index_flights_on_destination", using: :btree
    t.index ["origin"], name: "index_flights_on_origin", using: :btree
  end

  create_table "weathers", force: :cascade, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8" do |t|
    t.string   "city"
    t.datetime "date"
    t.text     "search_data", limit: 65535
    t.index ["city"], name: "index_weathers_on_city", using: :btree
  end

end
