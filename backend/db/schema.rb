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

ActiveRecord::Schema.define(version: 2019_02_24_223458) do

  create_table "delayed_jobs", options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.integer "priority", default: 0, null: false
    t.integer "attempts", default: 0, null: false
    t.text "handler", null: false
    t.text "last_error"
    t.datetime "run_at"
    t.datetime "locked_at"
    t.datetime "failed_at"
    t.string "locked_by"
    t.string "queue"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["priority", "run_at"], name: "delayed_jobs_priority"
  end

  create_table "dummies", options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "financial_transactions", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "plaid_id"
    t.string "plaid_name"
    t.string "merchant_name"
    t.string "category"
    t.string "source"
    t.decimal "amount", precision: 8, scale: 2
    t.datetime "transacted_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "hidden", default: false
    t.boolean "reviewed", default: false
    t.index ["category"], name: "index_financial_transactions_on_category"
    t.index ["merchant_name"], name: "index_financial_transactions_on_merchant_name"
    t.index ["plaid_id"], name: "index_financial_transactions_on_plaid_id"
    t.index ["plaid_name"], name: "index_financial_transactions_on_plaid_name"
    t.index ["transacted_at"], name: "index_financial_transactions_on_transacted_at"
  end

  create_table "plaid_balances", options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "bank_name", null: false
    t.string "card_name", null: false
    t.decimal "current_balance", precision: 8, scale: 2, null: false
    t.decimal "pending_balance", precision: 8, scale: 2, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bank_name"], name: "index_plaid_balances_on_bank_name"
    t.index ["card_name"], name: "index_plaid_balances_on_card_name"
    t.index ["created_at"], name: "index_plaid_balances_on_created_at"
  end

  create_table "plaid_banks", options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "name", null: false
    t.string "token", null: false
    t.index ["name"], name: "index_plaid_banks_on_name"
  end

  create_table "versions", options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", force: :cascade do |t|
    t.string "item_type", limit: 191, null: false
    t.integer "item_id", null: false
    t.string "event", null: false
    t.string "whodunnit"
    t.text "object", limit: 4294967295
    t.datetime "created_at"
    t.text "object_changes", limit: 4294967295
    t.index ["item_type", "item_id"], name: "index_versions_on_item_type_and_item_id"
  end

end
