RAILS_ROOT = ENV['RAILS_ROOT'] || File.dirname(__FILE__) + '/../..'

require 'resque-scheduler'
require 'resque/scheduler/server'

Resque.redis = 'localhost:6379'
Resque.schedule = YAML.load_file(File.join(RAILS_ROOT, 'config/resque_schedule.yml')) # load the schedule

