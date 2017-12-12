  module Southwest
    class Search

    ROOT_URL = 'https://www.southwest.com'
    SEARCH_URL = "#{ROOT_URL}/flight/search-flight.html"
    FLEXIBLE_URL = "#{ROOT_URL}/flight/shortcut/select-flight.html?fromShowItinerary=1&int="

    def mechanize_agent
      @mechanize_agent ||= begin
        mechanize_agent = Mechanize.new do |agent|
          agent.user_agent_alias = 'Mac Safari'
        end
      end
    end

    def runner
      paths = desired_paths
      dates = desired_dates

      paths.each do |path|
        dates.each do |date|
          search(path, date)
        end
      end
    end

    def search(path, dates)
      mechanize_agent.get(SEARCH_URL) do |page|

        form = page.form('buildItineraryForm')

        form.originAirport = path[0]
        form.destinationAirport = path[1]

        form.outboundDateString = dates[0]
        form.returnDateString = dates[1]
        
        search_page = mechanize_agent.submit(form)

        click_for_flexible_page = search_page.search(".shortcutNotification a").first

        flexible_page = mechanize_agent.click(click_for_flexible_page)

        cheapest_flexible = analyze_flexible_page(flexible_page)
        cheapest_search = analyze_search_page(search_page)

        f = Flight.new
        f.origin = path[0]
        f.destination = path[1]

        f.departure_date = DateTime.strptime(dates[0], '%m/%d/%Y')
        f.arrival_date = DateTime.strptime(dates[1], '%m/%d/%Y')

        f.flexible_data = cheapest_flexible
        f.search_data = cheapest_search

        f.save!
      end
    end

    private

    def analyze_flexible_page(flexible_page)
      flexible_depart_cells = flexible_page.search(".outboundCalendar_calendarCell .screenreader-only").map { |x| filter_text(x.text) }
      flexible_arrive_cells = flexible_page.search(".returnCalendar_calendarCell .screenreader-only").map { |x| filter_text(x.text) }

      formatting = Proc.new do |x|
        x.map do |y|
          month = y.split("$").first
          dollar = y.split("$").last.to_i

          {
            date: month.strip,
            amount: dollar
          }
        end.sort_by { |k| k[:amount]}
      end

      depart = formatting.call(flexible_depart_cells)
      arrive = formatting.call(flexible_arrive_cells)

      {
        depart: depart,
        arrive: arrive
      }
    end

    def analyze_search_page(search_page)
      formatting = Proc.new do |x|
        {
          flight_depart: x.search('.depart_column').map { |y| filter_text(y.text) },
          flight_arrive: x.search('.arrive_column').map { |y| filter_text(y.text) },
          price: x.search('.price_column').map { |y| filter_text(y.text) }.last.split.first,
        }
      end

      depart_cells = search_page.search('#faresOutbound tbody tr.nonstop').map { |x| formatting.call(x) }
      arrive_cells = search_page.search('#faresReturn tbody tr.nonstop').map { |x| formatting.call(x) }

      {
        depart: depart_cells,
        arrive: arrive_cells
      }
    end

    def filter_text(text)
      text.gsub(/\s+/, "..").split("..").reject(&:empty?)[0,3].join(' ')
    end

    def desired_paths
      [
        ['LAX', 'ABQ'],
        ['ABQ', 'LAX'],
        ['LAX', 'DAL'],
        ['DAL', 'LAX'],
      ]
    end

    def desired_dates
      desired_date_intervals.map do |date_interval|
        date_interval.map do |date|
          (DateTime.now + date).strftime('%m/%d/%Y')
        end
      end
    end

    def desired_date_intervals
      [0,1,2,3].map do |month|
        [14,17].map {|date| date + days_in_month * month}
      end
    end

    def days_in_month
      30
    end

  end
end