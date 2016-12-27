require 'mechanize'
require 'pry'

class Southwest

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

  def debug
    x = 'results_LAX_ABQ_01102017_01132017.html'
    y = 'flexible_LAX_ABQ_01102017_01132017.html'

    flexible_page = mechanize_agent.get("file:///Users/aahmed/code/dev/jarvis/lib/southwest/flexible_LAX_ABQ_01102017_01132017.html")
    results_page = mechanize_agent.get("file:///Users/aahmed/code/dev/jarvis/lib/southwest/results_LAX_ABQ_01102017_01132017.html")

    flexible_depart_cells = flexible_page.search(".outboundCalendar_calendarCell .screenreader-only")
    flexible_arrive_cells = flexible_page.search(".returnCalendar_calendarCell .screenreader-only")

    flexible_depart_info = flexible_depart_cells.map { |x| x.text.gsub(/\s+/, "|") }
    flexible_arrive_info = flexible_arrive_cells.map { |x| x.text.gsub(/\s+/, "|") }

    depart_cells = results_page.search('#faresOutbound tbody tr.nonstop')
    arrive_cells = results_page.search('#faresReturn tbody tr.nonstop')
    
    # TODO don't just convert to text right away
    depart_info = depart_cells.map { |x| x.text.gsub(/\s+/, "|") }
    arrive_info = arrive_cells.map { |x| x.text.gsub(/\s+/, "|") }
  end

  def runner
    paths = desired_paths
    dates = desired_dates

    paths.each do |path|
      dates.each do |date|
        search(path, date)
        break
      end
    end
  end

  def search(path, dates)
    mechanize_agent.get(SEARCH_URL) do |page|
      form = page.form('buildItineraryForm')

      file_suffix = "#{path.join("_")}_#{dates.join("_").gsub("/",'')}"
      results_filename = "results_#{file_suffix}.html"
      flexible_results_filename = "flexible_#{file_suffix}.html"

      # form.originAirport_displayed = 'Los Angeles, CA - LAX'
      # form.destinationAirport_displayed = 'Albuquerque, NM - ABQ'

      form.originAirport = path[0]
      form.destinationAirport = path[1]

      form.outboundDateString = dates[0]
      form.returnDateString = dates[1]
      
      new_page = mechanize_agent.submit(form)

      File.write("#{File.dirname(__FILE__)}/#{results_filename}", new_page.content)

      click_for_flexible_page = new_page.search(".shortcutNotification a").first

      flexible_page = mechanize_agent.click(click_for_flexible_page)

      File.write("#{File.dirname(__FILE__)}/#{flexible_results_filename}", flexible_page.content)
    end
  end

  def desired_paths
    [
      ['LAX', 'ABQ'],
      # ['LAX', 'DAL'],
      # ['ABQ', 'LAX'],
      # ['DAL', 'LAX'],
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


# Southwest.new.runner
Southwest.new.debug



