module Utils

  def titleize(x)
    "#{x.split.each{|x| x.capitalize!}.join(' ')}"
  end

  def translate_plaid_name(plaid_name)
    tmp = plaid_name.
      split(" ").
      delete_if { |a| a.count("0-9") > 2 }

    tmp.pop if tmp.last.count("0-9") > 0
      
    titleize(tmp.join(" "))
  end

  def year
    DateTime.now.strftime('%Y')
  end

  def month
    DateTime.now.strftime('%m')
  end
  
end