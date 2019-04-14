module Utils
  def titleize(str)
    str.split.each(&:capitalize!).join(' ').to_s
  end

  def translate_plaid_name(plaid_name)
    titleize(plaid_name.gsub(/\d+/, ''))
  end

  def year
    DateTime.now.strftime('%Y')
  end

  def month
    DateTime.now.strftime('%m')
  end
end
