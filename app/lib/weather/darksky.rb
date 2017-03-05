require 'pry'
require 'rest-client'
require 'json'

require_relative '../../db/models/weather'


class Weather

  class Darksky
    
    def runner(city)
      cities = {
        "Austin" => [30.2672, -97.7431],
        "Los Angeles" => [34.0522, -118.2437],
        "Albuquerque" => [35.0853, -106.6056]
      }

      api_key = ENV['DARKSKY_API_KEY']
      base_url = "https://api.darksky.net/forecast"

      c = cities[city]

      (DateTime.new(2013, 01, 01)..DateTime.new(2014, 12, 31)).each do |date|
        url = "#{base_url}/#{api_key}/#{c.first},#{c.last},#{date.to_i}"
        x = RestClient.get url
        w = Weather.new
        w.city = city
        w.date = date
        w.search_data = x.body
        w.save!
      end

    end

  end

end

city = "Austin"

Weather::Darksky.new.runner(city)