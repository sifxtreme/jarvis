require 'rubygems'
require 'mechanize'
require 'pry'

a = Mechanize.new { |agent|
  agent.user_agent_alias = 'Mac Safari'
}

a.get('https://www.southwest.com/flight/search-flight.html') do |page|
  form = page.form('buildItineraryForm')


  # form.originAirport_displayed = 'Los Angeles, CA - LAX'
  # form.destinationAirport_displayed = 'Albuquerque, NM - ABQ'
  form.originAirport = 'LAX'
  form.destinationAirport = 'ABQ'

  form.outboundDateString = '10/29/2016'
  form.returnDateString = '10/31/2016'
  
  new_page = a.submit(form)

  File.write('ss.html', new_page.content)

  a.get('https://www.southwest.com/flight/shortcut/select-flight.html?fromShowItinerary=1&int=') do |page|
    File.write('ss1.html', page.content)
  end

  
  
end