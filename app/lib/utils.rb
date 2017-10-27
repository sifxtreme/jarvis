module Utils

  def titleize(x)
    "#{x.split.each{|x| x.capitalize!}.join(' ')}"
  end

  def translate_plaid_name(plaid_name)
    begin
      tmp = plaid_name.
        split(" ").
        delete_if { |a| a.count("0-9") > 2 }

      tmp.pop if tmp.last.count("0-9") > 0

      titleize(tmp.join(" "))
    rescue => e
      plaid_name
    end
  end

  def year
    DateTime.now.strftime('%Y')
  end

  def month
    DateTime.now.strftime('%m')
  end

  def month_difference(a, b)
    difference = 0.0
    if a.year != b.year
      difference += 12 * (b.year - a.year)
    end
    difference + b.month - a.month + 1
  end
  
end