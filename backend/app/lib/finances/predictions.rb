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

  TRAINING_WINDOW = 24.months  # learn only from recent history (see #curated)
  MIN_KEY_LENGTH = 4       # don't prefix-match on tiny keys
  MAJORITY = 0.5           # a learned prediction needs >50% agreement
  MIN_VOTES = 2            # ...and must be backed by >=2 transactions.
                           # A one-off label must never propagate: a single historical
                           # "LAKEWOOD, CA" tagged "Ramadan Party 2024" was being applied
                           # to every future Lakewood charge. Predict from patterns seen
                           # twice, not from a single quirky tag.

  def predict_new_transactions
    FinancialTransaction.where(reviewed: false, merchant_name: nil, category: nil).each do |f|
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

  # Returns {merchant_name:, category:, source:} for a transaction.
  # Tiers, highest confidence first. Learned history ALWAYS beats Plaid's guess.
  def predict(txn)
    key = merchant_key(txn.plaid_name)
    entity = entity_id_for(txn)

    # 1. Learned by Plaid's stable merchant_entity_id. Same merchant => same id,
    #    forever, regardless of how the string is formatted. Strongest signal.
    if entity && (learned = by_entity[entity])
      return result(learned, txn, 'learned:entity_id')
    end

    # 2. Learned by exact canonical merchant key.
    if key && (learned = by_key[key])
      return result(learned, txn, 'learned:key')
    end

    # 3. Learned by anchored token-PREFIX. This is what bridges Teller's raw
    #    "amazon marketplace amzn bill" history to Plaid's clean "amazon".
    #    Anchored at a token boundary ON PURPOSE — a naive substring match would
    #    resurrect the "Bug Zapper Racket" -> 'racket' -> Yusuf+Musa false positive.
    if key && key.length >= MIN_KEY_LENGTH && (learned = prefix_lookup(key))
      return result(learned, txn, 'learned:prefix')
    end

    # 4. Plaid's own classifier, mapped conservatively to the taxonomy.
    if (pfc = PFC_CATEGORY_MAP[pfc_detailed(txn)])
      return { merchant_name: plaid_merchant_name(txn), category: pfc, source: 'plaid:pfc' }
    end

    # 5. Vetted keyword rules (whole-token). Lowest-confidence tier — and the only
    #    category signal that exists at all for Teller/Chase rows, which carry no
    #    personal_finance_category.
    if key && (kw = keyword_category(key))
      return { merchant_name: plaid_merchant_name(txn), category: kw, source: 'keyword' }
    end

    # 6. Nothing confident. Still hand back Plaid's clean merchant name if we have
    #    one — a named-but-uncategorized row is far easier to review than a raw blob.
    { merchant_name: plaid_merchant_name(txn), category: nil, source: 'unmatched' }
  end

  private

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

  def result(learned, txn, source)
    {
      merchant_name: learned[:merchant_name] || plaid_merchant_name(txn),
      category: learned[:category],
      source: source
    }
  end

  # ---- Plaid raw_data accessors (nil-safe for Teller rows) ----

  def raw(txn)
    txn.raw_data.is_a?(Hash) ? txn.raw_data : {}
  end

  def entity_id_for(txn)
    raw(txn)['merchant_entity_id'].presence
  end

  def plaid_merchant_name(txn)
    raw(txn)['merchant_name'].presence
  end

  def pfc_detailed(txn)
    raw(txn).dig('personal_finance_category', 'detailed')
  end

  # ---- Learned indexes (built once from curated history) ----

  # Any learned key whose tokens the lookup key is a prefix of (or vice versa).
  # Aggregates every match so "amazon" pools ALL amazon history, then takes the
  # majority. Returns nil if no category clears the majority threshold.
  def prefix_lookup(key)
    matches = by_key.select do |k, _|
      k == key || k.start_with?("#{key} ") || key.start_with?("#{k} ")
    end
    return nil if matches.empty?

    merged_category = merge_votes(matches.values.map { |v| v[:category_votes] })
    merged_name     = merge_votes(matches.values.map { |v| v[:name_votes] })
    return nil if merged_category.nil? && merged_name.nil?

    { category: merged_category, merchant_name: merged_name }
  end

  def merge_votes(vote_hashes)
    totals = vote_hashes.each_with_object(Hash.new(0)) do |votes, acc|
      votes.each { |value, count| acc[value] += count if value.present? }
    end
    majority(totals)
  end

  def majority(votes)
    total = votes.values.sum
    return nil if total.zero?

    value, count = votes.max_by { |_, c| c }
    return nil if count < MIN_VOTES

    count.to_f / total > MAJORITY ? value : nil
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
      entry[:merchant_name] = majority(entry[:name_votes])
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
  end

end
