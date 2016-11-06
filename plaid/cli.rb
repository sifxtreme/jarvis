require_relative './api'

plaid = Plaid::Api.new

plaid.sync_all

# plaid.sync_to_database('capital_one')