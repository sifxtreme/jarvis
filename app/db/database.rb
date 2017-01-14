require 'active_record'
require 'mysql2'

ActiveRecord::Base.establish_connection(
  adapter: "mysql2",
  encoding: "utf8",
  reconnect: false,
  database: "jarvis",
  pool: 30,
  username: "root",
  password: "root",
  host: "jarvis",
  port: 3307,
  timeout: 5000
)