require 'pry'

require_relative '../../db/models/weather'

module Analysis
  class Weather

    def runner(city, attribute)
      data = get_data_for(city)

      begin
        weekly_avgs = get_weekly_average_of_attribute(data, attribute)
        
        {
          keys: weekly_avgs.keys, 
          values: weekly_avgs.values
        }
      rescue StandardError => e
        puts e.message
      end
    end

    private

    def get_data_for(city)
      start_date = '2015-01-01'
      end_date = '2015-12-31'

      ::Weather.where(city: city).
                where("date between ? and ?", start_date, end_date).
                  order("date")
    end

    def parse_for_weather_data(model_data)
      JSON.parse(model_data.search_data)['daily']['data'].first
    end

    def get_average_of_attribute(data, attribute)
      total = 0
      count = 0

      data.each do |d|
        info = parse_for_weather_data(d)
        total += info[attribute]
        count += 1
      end

      total/count
    end

    def get_weekly_average_of_attribute(data, attribute)
      info = {}

      start_index = 0
      end_index = start_index + 6

      while start_index < data.size
        begin
          index = data[start_index].date.to_s.split(" ").first
          info[index] = get_average_of_attribute(data[start_index..end_index], attribute)
          start_index += 7
          end_index += 7
        rescue StandardError => e
          break
        end
      end

      info
    end

  end
end
