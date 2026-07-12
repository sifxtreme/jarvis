module Utils

  def titleize(str)
    str.split.each(&:capitalize!).join(' ').to_s
  end

  def translate_plaid_name(plaid_name)
    titleize(plaid_name.gsub(/\d+/, ''))
  end

  # Canonical merchant key used for learned-category lookups.
  #
  # The old translate_plaid_name only stripped digits + titleized, so Teller's raw
  # strings ("AMAZON MARKETPLACE NAMZN.COM/BILL WA") and Plaid's clean merchant_name
  # ("Amazon") normalized to DIFFERENT keys — meaning years of learned history never
  # matched a single new Plaid row. This collapses both onto the same key.
  #
  # Strips, in order: payment-processor prefixes, domains, store/ref numbers,
  # punctuation, and a trailing 2-letter state code (the "HOMEDEPOT.COM ... GA"
  # → "Gas" false-positive landmine).
  PAYMENT_PREFIXES = /\A(aplpay|apple pay|sq ?\*|tst ?\*|sp |py ?\*|paypal ?\*|pos |dd ?\*|ec ?\*|tcktweb ?\*|etip )/i
  US_STATES = %w[al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc].freeze

  def merchant_key(name)
    return nil if name.blank?

    key = name.to_s.downcase.strip
    key = key.sub(PAYMENT_PREFIXES, '')            # AplPay / SQ* / TST* / PayPal*

    # Strip the TLD and anything after it, but KEEP the name in front of the dot.
    #   "fandango.com 866-..."      -> "fandango ..."
    #   "amazon.com amzn.com/bill"  -> "amazon amzn"
    #   "madewell.com 866-544-1937" -> "madewell"
    #
    # This used to remove the WHOLE domain token (`\b[\w.-]+\.(com|...)`), which ate
    # the merchant name itself: "FANDANGO.COM 866-857-5191 CA" collapsed all the way
    # down to the key "ca", so every .COM merchant with a trailing state code merged
    # into one bucket. That's how a Fandango charge started predicting "Netflix".
    key = key.gsub(/\.(com|org|net|co|io|gov)\b\S*/, ' ')

    key = key.gsub(/\d+/, ' ')                     # store / ref numbers
    key = key.gsub(/[^a-z\s]/, ' ')                # punctuation: * # / etc
    key = key.squeeze(' ').strip

    tokens = key.split
    tokens.pop if tokens.size > 1 && US_STATES.include?(tokens.last) # trailing state code
    tokens.join(' ').strip.presence
  end

  def year
    DateTime.now.strftime('%Y')
  end

  def month
    DateTime.now.strftime('%m')
  end

end
