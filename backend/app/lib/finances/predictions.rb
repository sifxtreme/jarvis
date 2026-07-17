class Finances::Predictions

  include Utils

  # Plaid's personal_finance_category → Asif's taxonomy.
  #
  # DELIBERATELY CONSERVATIVE. Only "what kind of purchase" categories are mapped —
  # those are the ones Plaid's classifier can actually know. The person/purpose
  # categories (Hafsa, Yusuf, Musa, Kids, Gifts, Nanny, Asif Career, Family…) are
  # NOT mapped and never will be: Plaid cannot know that a Madewell charge is
  # "Hafsa" or that a Target run is "Kids". Those must come from learned history.
  #
  # GENERAL_MERCHANDISE_* (Amazon, clothing, superstores), GENERAL_SERVICES_* and
  # most ENTERTAINMENT_* are intentionally left UNMAPPED — they're genuinely
  # ambiguous, and a blank the user reviews beats a wrong guess that silently
  # distorts monthly totals.
  PFC_CATEGORY_MAP = {
    'FOOD_AND_DRINK_RESTAURANT'                     => 'Eating Out',
    'FOOD_AND_DRINK_FAST_FOOD'                      => 'Eating Out',
    'FOOD_AND_DRINK_COFFEE'                         => 'Eating Out',
    'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK'           => 'Eating Out',
    'FOOD_AND_DRINK_GROCERIES'                      => 'Groceries',
    'TRANSPORTATION_GAS'                            => 'Gas',
    'TRANSPORTATION_PARKING'                        => 'Parking',
    'TRANSPORTATION_TOLLS'                          => 'Parking',
    'GOVERNMENT_AND_NON_PROFIT_DONATIONS'           => 'Charity',
    'MEDICAL_PRIMARY_CARE'                          => 'Medical Expenses',
    'MEDICAL_DENTAL_CARE'                           => 'Medical Expenses',
    'MEDICAL_EYE_CARE'                              => 'Medical Expenses',
    'MEDICAL_PHARMACIES_AND_SUPPLEMENTS'            => 'Medical Expenses',
    'MEDICAL_OTHER_MEDICAL'                         => 'Medical Expenses',
    'PERSONAL_CARE_HAIR_AND_BEAUTY'                 => 'Personal Care',
    'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'        => 'Personal Care',
    'PERSONAL_CARE_OTHER_PERSONAL_CARE'             => 'Personal Care',
    'HOME_IMPROVEMENT_FURNITURE'                    => 'Home',
    'HOME_IMPROVEMENT_HARDWARE'                     => 'Home',
    'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE'       => 'Home',
    'HOME_IMPROVEMENT_SECURITY'                     => 'Home',
    'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT'       => 'Home',
    'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'        => 'Bills',
    'RENT_AND_UTILITIES_INTERNET_AND_CABLE'         => 'Bills',
    'RENT_AND_UTILITIES_WATER'                      => 'Bills',
    'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT'=> 'Bills',
    'RENT_AND_UTILITIES_OTHER_UTILITIES'            => 'Bills',
    'RENT_AND_UTILITIES_TELEPHONE'                  => 'Cellphone',
    'TRAVEL_FLIGHTS'                                => 'Travel',
    'TRAVEL_LODGING'                                => 'Travel',
    'TRAVEL_RENTAL_CARS'                            => 'Travel',
    'TRAVEL_OTHER_TRAVEL'                           => 'Travel'
  }.freeze

  # Vetted keyword rules — the LOWEST-confidence tier, below Plaid's classifier.
  # This is where the old node `auto-categorize` engine's useful logic now lives:
  # one resolver owns the write, System B survives only as a governed tier.
  #
  # It earns its place for a specific reason: TELLER rows (Chase) carry NO
  # personal_finance_category at all, so the Plaid-classifier tier simply does not
  # exist for them. Learned history is otherwise their only signal. This fills that.
  #
  # The three things that made the old engine dangerous are structurally impossible
  # here:
  #   - matching is WHOLE-TOKEN against merchant_key, never substring (that's the
  #     "Bug Zapper Racket" -> 'racket' -> kids-category class of bug)
  #   - merchant_key already strips trailing state codes, so "HOMEDEPOT.COM ... GA"
  #     can never again match "Gas"
  #   - there is deliberately NO blanket Amazon rule. Amazon is ambiguous by nature
  #     and belongs to the item-lookup pipeline, not to a guess.
  KEYWORD_RULES = {
    'Groceries'            => ['costco', 'sprouts', 'ralphs', 'vons', 'albertsons', 'safeway',
                               'aldi', 'trader joes', 'whole foods', 'h mart', 'harvest fresh'],
    'Eating Out'           => ['starbucks', 'doordash', 'grubhub', 'chipotle', 'mcdonalds',
                               'dominos', 'uber eats'],
    'Gas'                  => ['shell', 'chevron', 'arco', 'mobil', 'exxon'],
    'Parking'              => ['parking'],
    'Dues & Subscriptions' => ['netflix', 'spotify', 'hulu'],
    'Home'                 => ['lowes', 'ikea', 'home depot'],
    'Charity'              => ['irusa', 'kinderusa', 'launchgood']
  }.freeze

  # The ONLY categories a learned tier is allowed to auto-fill. Asif's `category`
  # column is overloaded with two different kinds of value, and they must be handled
  # differently:
  #
  #   RECURRING LABEL — true of the same MERCHANT (or payer) every time it recurs.
  #     Two flavours, both propagate:
  #       - stable spending buckets: Sprouts→Groceries, Shell→Gas, the mortgage.
  #       - the person/purpose axis: a paycheck merchant→"Hafsa Income", a specific
  #         store→"Asif Career", the kids' recurring merchants→"Yusuf + Musa".
  #     Backtested at 96% precision on the person/purpose rows because the ones that
  #     actually fire are merchant-locked (income, career). Asif chose to keep these
  #     auto-filled (2026-07-17) rather than review each by hand.
  #
  #   ONE-OFF OCCASION — true of a single TRIP / PROJECT / PARTY, not the merchant.
  #     "Universal Studios" (9 merchants in 1 day), "Thanksgiving 2024" (7/9d),
  #     "Hawaii Trip" (56/8d), "Paris Trip", "2024-12 Bathroom Project", "Parties".
  #     The same merchant that was "Thanksgiving 2024" once is a plain grocery run
  #     the other 51 weeks. Stamping the occasion onto every future charge is the
  #     exact bug Asif reported — a stale event label propagating forward.
  #
  # The learned tiers (entity/key/prefix) vote on whatever label won, blind to which
  # kind it is. This allowlist is the discriminator: a learned winner that is NOT in
  # here is treated as "no confident answer" and the row is left blank for review.
  # A new TRIP/PROJECT/PARTY tag is therefore non-propagating BY DEFAULT — it never
  # leaks until deliberately added here (and it won't be). (PFC_CATEGORY_MAP and
  # KEYWORD_RULES already only ever emit stable buckets, so they need no filter.)
  #
  # Derived from every reviewed category in the last 24 months (104 of them). The
  # ONLY ones deliberately absent are the specific occasions — every named trip
  # (Hawaii/Paris/Turkey/ABQ...), project (Bathroom/Bedroom/Wallpaper), party and
  # birthday, plus bursty one-offs (Hafsa Bonus, Home Repair, AC Repairs) and junk
  # (Payment/Transfer/Shame/??? /Walmart). Everything recurring is IN.
  PROPAGATING_CATEGORIES = [
    # everyday spending
    'Groceries', 'Eating Out', 'Coffee', 'Fun',
    # transportation
    'Gas', 'Parking', 'Tolls', 'Car Maintenance', 'Car Insurance', 'Tesla Car Payment', 'Tesla',
    # home & utilities
    'Home', 'Home Software', 'Mortgage', 'Bills', 'Electricity', 'Internet', 'Cellphone',
    'Water + Trash', 'Home Gas', 'Gardener',
    # health & personal
    'Medical Expenses', 'Personal Care',
    # recurring commitments / subscriptions (merchant-locked, so perfectly stable)
    'Dues & Subscriptions', 'Netflix', 'Spotify', 'Robinhood',
    # giving
    'Charity', 'Zakat',
    # kids / education / childcare (recurring, merchant-stable)
    'Tutoring', 'Tuition', 'Islamic Education', 'Sunday School', '529 Children',
    'Sports and Classes', 'Babysitting',
    # community
    'Muslim Businesses',
    # generic recurring travel bucket — NOT any specific named trip
    'Travel and Trips',
    # person / purpose axis — merchant-locked, auto-filled per Asif's call (2026-07-17)
    'Asif', 'Asif Career', 'Asif Income', 'Asif Work', 'Asif Family', 'Asif Parents',
    'Hafsa', 'Hafsa Career', 'Hafsa Income', 'Hafsa Work', 'Hafsa Family',
    'Sulaiman', 'Yusuf + Musa', 'Gifts', 'Nanny'
  ].freeze

  # A learned category may only be auto-filled if it names a recurring merchant/payer
  # label. A one-off occasion (trip/project/party) stays blank for review.
  def self.propagatable?(category)
    PROPAGATING_CATEGORIES.include?(category)
  end

  # Merchants whose merchant_name is ITEM-SPECIFIC — a different product every time.
  # Their CATEGORY is perfectly learnable (Kindle is always Hafsa's books), but their
  # NAME must NEVER be propagated. Majority-vote will otherwise latch onto one
  # arbitrary item and stamp it on everything.
  #
  # Real damage (2026-07-12): the key "amazon kindle" learned merchant_name
  # "Simple and Sinister" (one book Asif happened to have labeled twice), then wrote
  # that SAME title onto 5 different Kindle purchases at 5 different prices — which
  # were 5 different books (the Kingmaker Chronicles + Blood and Ash series).
  #
  # Item names for these merchants come from the item-lookup pipeline or Amazon's
  # digital-orders page. NEVER from a guess. Listed explicitly — no prefix matching,
  # because "amazon web services" (AWS), "amazon prime" and "amazon fresh" DO have
  # stable names and must keep learning them.
  ITEM_SPECIFIC_MERCHANTS = [
    'amazon',
    'amazon marketplace',
    'amazon kindle',
    'kindle',
    'kindle svcs'
  ].freeze

  TRAINING_WINDOW = 24.months  # learn only from recent history (see #curated)
  MIN_KEY_LENGTH = 4       # don't prefix-match on tiny keys
  MAJORITY = 0.5           # a learned CATEGORY needs >50% agreement

  # A learned NAME needs a far higher bar than a category, because they are not the
  # same kind of thing:
  #   - a merchant's CATEGORY is stable  (Fandango is always Fun)
  #   - a merchant's NAME is often WHAT YOU BOUGHT THAT DAY (a different movie, a
  #     different book, a different Amazon item)
  #
  # Treating them identically is what produced every name bug so far:
  #   FANDANGO.COM   -> "Dog Man Snacks"      (one Feb-2025 movie outing, 2 of 3 votes)
  #   Amazon Kindle  -> "Simple and Sinister" (one book, stamped on 5 different books)
  #   LAKEWOOD, CA   -> "Ramadan Party 2024"  (one 2024 event)
  # Each cleared MIN_VOTES and the 50% majority. A one-off event name only has to
  # appear twice to win a 3-transaction history.
  #
  # So: only propagate a name when the merchant's history is near-UNANIMOUS about it.
  # "Sprouts" is always "Sprouts" (100%) and still propagates. "Dog Man Snacks" at
  # 67% does not.
  NAME_MAJORITY = 0.8
  NAME_MIN_VOTES = 3
  MIN_VOTES = 2            # ...and must be backed by >=2 transactions.
                           # A one-off label must never propagate: a single historical
                           # "LAKEWOOD, CA" tagged "Ramadan Party 2024" was being applied
                           # to every future Lakewood charge. Predict from patterns seen
                           # twice, not from a single quirky tag.

  # Re-attempt every UNREVIEWED row that is still missing EITHER field — not only
  # rows blank on both.
  #
  # The old scope (merchant_name: nil AND category: nil) had a trap: a row the
  # predictor once filled a NAME for but no category (which is common — a merchant's
  # name is easy, its category may not clear the vote) no longer has a nil
  # merchant_name, so it was never looked at again. It froze half-categorized
  # forever. That is exactly how the Sprouts rows got stuck: an earlier run wrote
  # merchant_name "Sprouts Farmers Market" with a nil category, and every run since
  # skipped them. Retrying whenever category OR name is missing lets a later, better
  # prediction (or newly-learned history) fill the gap. Reviewed rows are Asif's
  # confirmed truth and are never touched.
  def predict_new_transactions
    FinancialTransaction.where(reviewed: false)
                        .where('category IS NULL OR merchant_name IS NULL').each do |f|
      result = predict(f)

      f.merchant_name = result[:merchant_name]
      f.category = result[:category]
      f.save!

      Rails.logger.info(
        "[Predict] #{f.plaid_name} -> name=#{result[:merchant_name].inspect} " \
        "category=#{result[:category].inspect} via=#{result[:source]}"
      )
    end
  end

  # A descriptor that is JUST a city is NOT a merchant, and must never be used as a
  # learning key.
  #
  # Square (and others) pass through only the location when the seller hasn't set a
  # business name. A $209.92 TNT Fireworks purchase arrived as literally
  # "LAKEWOOD, CA" — Plaid's merchant_name was null, and its classifier guessed
  # RENT_AND_UTILITIES (because "CITY OF LAKEWOOD" looks like a utility bill).
  #
  # Keying on that collides every merchant in the town:
  #   H MART - LAKEWOOD       -> Groceries
  #   CHARO CHICKEN LAKEWOOD  -> Eating Out
  #   CITY OF LAKEWOOD        -> Bills
  #   LAKEWOOD, CA            -> a Ramadan party / movie snacks / fireworks
  # all normalize to "lakewood". THIS is the actual root of both the
  # "Ramadan Party 2024" and "Dog Man Snacks" bugs — not the individual labels.
  #
  # Such a transaction is unidentifiable from bank data alone (the only place
  # "TNT Fireworks" exists is the digital receipt). So: predict nothing, and learn
  # nothing from it. A blank the user resolves beats a confident collision.
  def location_only?(txn)
    key = merchant_key(txn.plaid_name)
    return false if key.blank?

    city = merchant_key(raw(txn).dig('location', 'city'))
    city.present? && key == city
  end

  # Returns {merchant_name:, category:, source:} for a transaction.
  # Tiers, highest confidence first. Learned history ALWAYS beats Plaid's guess.
  #
  # A tier wins only if it HAS AN ANSWER. This used to be "the first tier whose key
  # is present wins", which is a different and much worse rule: build_index resolves
  # every entry's category through majority(), and that returns nil whenever the
  # votes don't clear MIN_VOTES/MAJORITY. So a merchant Asif had labelled ONCE got
  # an index entry that existed but held nothing — and matching it returned nil and
  # vetoed every tier below.
  #
  #   "SPROUTS" -> key "sprouts" -> {category_votes: {"Groceries" => 1}} -> 1 vote,
  #   MIN_VOTES is 2 -> category nil -> matched 'learned:key' -> returned nil.
  # ...while tier 4 (Plaid says FOOD_AND_DRINK_GROCERIES) and tier 5 (the vetted
  # 'sprouts' keyword) BOTH knew it was Groceries and never got to run.
  #
  # That was not one merchant: 991 of 1,239 learned keys resolve to a nil category
  # (the reviewed-only training set is thin, so most keys are single-vote). Every
  # one was a dead end that silently suppressed the tiers that still worked.
  #
  # "Not enough evidence" must fall through. The only verdict that means
  # "deliberately predict nothing" is location_only?, which returns above.
  def predict(txn)
    # The descriptor is just a city — there is no merchant here to reason about.
    return { merchant_name: nil, category: nil, source: 'location-only' } if location_only?(txn)

    key = merchant_key(txn.plaid_name)
    learned = learned_tiers(key, entity_id_for(txn))

    category, source = resolve_category(learned, txn, key)
    { merchant_name: resolve_name(learned, txn, key), category: category, source: source }
  end

  private

  # The learned tiers that matched, strongest first, as [entry, source] pairs.
  # A match here is a CANDIDATE, not a verdict — the entry may hold no answer.
  #
  #   1. Plaid's stable merchant_entity_id. Same merchant => same id, forever,
  #      regardless of how the string is formatted. Strongest signal.
  #   2. The exact canonical merchant key.
  #   3. Anchored token-PREFIX — bridges Teller's raw "amazon marketplace amzn bill"
  #      history to Plaid's clean "amazon". Anchored at a token boundary ON PURPOSE:
  #      a naive substring match would resurrect the "Bug Zapper Racket" -> 'racket'
  #      -> Yusuf+Musa false positive.
  def learned_tiers(key, entity)
    tiers = []
    tiers << [by_entity[entity], 'learned:entity_id'] if entity && by_entity[entity]
    tiers << [by_key[key], 'learned:key'] if key && by_key[key]
    if key && key.length >= MIN_KEY_LENGTH && (prefixed = prefix_lookup(key))
      tiers << [prefixed, 'learned:prefix']
    end
    tiers
  end

  # First tier with an actual category wins: learned history, then Plaid's own
  # classifier, then the vetted keyword rules.
  def resolve_category(learned, txn, key)
    learned.each do |entry, source|
      cat = entry[:category]
      next if cat.blank?                      # tier matched but holds no answer -> try next

      # A one-off OCCASION label (a specific trip/project/party) is not a recurring
      # merchant/payer label — never stamp it forward. This is the fix for stale event
      # labels ("Thanksgiving 2024", "Bathroom Project", "Hawaii Trip") propagating
      # onto unrelated future charges. Treat it as no-answer and keep looking: a
      # weaker learned tier, or Plaid's own classifier, may still know the real bucket
      # (Home Depot's history was polluted by a bathroom project, but Plaid still
      # classifies it HOME_IMPROVEMENT -> Home). Downstream tiers only ever emit
      # stable buckets, so falling through can never resurrect the occasion.
      next unless self.class.propagatable?(cat)

      return [cat, source]
    end

    # Plaid's own classifier, mapped conservatively to the taxonomy.
    if (pfc = PFC_CATEGORY_MAP[pfc_detailed(txn)])
      return [pfc, 'plaid:pfc']
    end

    # Vetted keyword rules (whole-token). Lowest-confidence tier — and the only
    # category signal that exists at all for Teller/Chase rows, which carry no
    # personal_finance_category.
    if key && (kw = keyword_category(key))
      return [kw, 'keyword']
    end

    # Nothing confident. resolve_name still hands back Plaid's clean merchant name
    # if we have one — a named-but-uncategorized row is far easier to review than a
    # raw blob.
    [nil, 'unmatched']
  end

  # Same rule for the name: first tier that has one. For item-specific merchants a
  # learned name is NEVER propagated — the name is what you bought that day, so we
  # hand back Plaid's generic name and let the item-lookup pipeline resolve the real
  # one. Propagating a learned name there is how every Kindle purchase became
  # "Simple and Sinister".
  def resolve_name(learned, txn, key)
    generic = plaid_merchant_name(txn)
    return generic if item_specific?(key)

    learned.each do |entry, _source|
      return entry[:merchant_name] if entry[:merchant_name].present?
    end

    generic
  end

  # Whole-token (and whole-phrase) keyword match against the canonical merchant key.
  # Never a substring match — that is the guardrail, not an implementation detail.
  def keyword_category(key)
    tokens = key.split
    KEYWORD_RULES.each do |category, keywords|
      keywords.each do |kw|
        kw_tokens = kw.split
        matched = if kw_tokens.size == 1
                    tokens.include?(kw)
                  else
                    tokens.each_cons(kw_tokens.size).any? { |slice| slice == kw_tokens }
                  end
        return category if matched
      end
    end
    nil
  end

  def item_specific?(key)
    key.present? && ITEM_SPECIFIC_MERCHANTS.include?(key)
  end

  # ---- Plaid raw_data accessors (nil-safe for Teller rows) ----

  def raw(txn)
    txn.raw_data.is_a?(Hash) ? txn.raw_data : {}
  end

  def entity_id_for(txn)
    raw(txn)['merchant_entity_id'].presence
  end

  # Plaid's clean merchant name, with one repair.
  #
  # Amex jams the merchant name into the city and then truncates the descriptor:
  #   "WB STUDIO ENT" + "NEW YORK"  ->  "AplPay WB STUDIO ENTNEW"   (YORK cut off)
  # Plaid then splits THAT at the wrong point, yielding merchant_name
  # "Wb Studio Entnew" with city "York". The city coming back as literally "York"
  # (never "New York") is the tell — and it makes this safe to key on: we only strip
  # a trailing "new" when Plaid ALSO reports the city as "York". Hits NYC merchants
  # only (La Cabra East, Artichoke, Apollo Bagels, Wintex Cotton...).
  def plaid_merchant_name(txn)
    name = raw(txn)['merchant_name'].presence
    return nil if name.blank?

    city = raw(txn).dig('location', 'city').to_s
    if city.casecmp('york').zero? && name.match?(/new\z/i)
      return name.sub(/new\z/i, '').strip.presence || name
    end

    name
  end

  def pfc_detailed(txn)
    raw(txn).dig('personal_finance_category', 'detailed')
  end

  # ---- Learned indexes (built once from curated history) ----

  # Any learned key whose tokens the lookup key is a prefix of (or vice versa).
  # Aggregates every match so "amazon" pools ALL amazon history, then takes the
  # majority. Returns nil if no category clears the majority threshold.
  def prefix_lookup(key)
    # DIRECTIONAL ON PURPOSE. Only the lookup key may be a prefix of learned keys:
    #   new "amazon" pools learned "amazon marketplace" / "amazon kindle"   <- wanted
    # The reverse is NOT allowed:
    #   learned "tesla" (the car loan) absorbing new "tesla insurance company"
    # ...which is a DIFFERENT merchant that merely shares a brand prefix. A holdout
    # backtest caught exactly that: "Tesla Insurance Company" was being predicted
    # "Tesla" when Asif labels it "Car Insurance". A generic brand must never swallow
    # a more specific sub-brand.
    matches = by_key.select { |k, _| k == key || k.start_with?("#{key} ") }
    return nil if matches.empty?

    merged_category = merge_votes(matches.values.map { |v| v[:category_votes] })
    merged_name     = merge_votes(matches.values.map { |v| v[:name_votes] }, name: true)
    return nil if merged_category.nil? && merged_name.nil?

    { category: merged_category, merchant_name: merged_name }
  end

  def merge_votes(vote_hashes, name: false)
    totals = vote_hashes.each_with_object(Hash.new(0)) do |votes, acc|
      votes.each { |value, count| acc[value] += count if value.present? }
    end
    name ? name_majority(totals) : majority(totals)
  end

  def majority(votes)
    total = votes.values.sum
    return nil if total.zero?

    value, count = votes.max_by { |_, c| c }
    return nil if count < MIN_VOTES

    count.to_f / total > MAJORITY ? value : nil
  end

  # Names get a stricter bar than categories — see NAME_MAJORITY.
  def name_majority(votes)
    total = votes.values.sum
    return nil if total.zero?

    value, count = votes.max_by { |_, c| c }
    return nil if count < NAME_MIN_VOTES

    count.to_f / total >= NAME_MAJORITY ? value : nil
  end

  def by_key
    @by_key ||= build_index { |txn| merchant_key(txn.plaid_name) }
  end

  def by_entity
    @by_entity ||= build_index { |txn| entity_id_for(txn) }
  end

  # Groups curated history by the given key, tallying category + merchant_name
  # votes, and resolves each to a majority winner.
  def build_index
    index = curated.each_with_object({}) do |txn, acc|
      key = yield(txn)
      next if key.blank?

      acc[key] ||= { category_votes: Hash.new(0), name_votes: Hash.new(0) }
      acc[key][:category_votes][txn.category] += 1 if txn.category.present?
      acc[key][:name_votes][txn.merchant_name] += 1 if txn.merchant_name.present?
    end

    index.each_value do |entry|
      entry[:category] = majority(entry[:category_votes])
      entry[:merchant_name] = name_majority(entry[:name_votes])
    end

    index
  end

  # The training set. TWO filters, both load-bearing:
  #
  # 1. reviewed: true — HUMAN-CONFIRMED LABELS ONLY. Without this the predictor
  #    trains on its own output: it writes merchant_name/category on unreviewed
  #    rows, those rows then look like "curated" history, and one bad prediction
  #    becomes its own supporting evidence. That feedback loop only gets worse as
  #    coverage rises (this pass took merchant_name from 34% -> 92%, so the training
  #    set would have become mostly self-written). Learn only from what Asif has
  #    actually confirmed. 15,995 of 16,383 named rows are reviewed, so this costs
  #    almost no signal and permanently closes the loop.
  #
  # 2. TRAINING_WINDOW — merchant->category mappings are stable (Sprouts is always
  #    Groceries), but ONE-TIME EVENT labels are not. A 2024 "Ramadan Party 2024"
  #    tag on a Lakewood charge was still driving 2026 predictions, and it survived
  #    MIN_VOTES because it had been tagged more than once. Letting the training set
  #    age out kills that class of bug. 24mo measured best on precision AND recall.
  def curated
    @curated ||= FinancialTransaction.where(hidden: false, reviewed: true)
                                     .where.not(merchant_name: nil)
                                     .where('transacted_at >= ?', TRAINING_WINDOW.ago)
                                     .select(:plaid_name, :merchant_name, :category, :raw_data)
                                     .to_a
                                     # ...and never LEARN from a city-only descriptor either.
                                     # Otherwise "lakewood" keeps accumulating labels from
                                     # every unrelated Square merchant in that town.
                                     .reject { |t| location_only?(t) }
  end

end
