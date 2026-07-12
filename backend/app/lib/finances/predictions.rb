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

  MIN_KEY_LENGTH = 4       # don't prefix-match on tiny keys
  MAJORITY = 0.5           # a learned prediction needs >50% agreement

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

    # 5. Nothing confident. Still hand back Plaid's clean merchant name if we have
    #    one — a named-but-uncategorized row is far easier to review than a raw blob.
    { merchant_name: plaid_merchant_name(txn), category: nil, source: 'unmatched' }
  end

  private

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

  # The training set: transactions the user has actually named/curated.
  def curated
    @curated ||= FinancialTransaction.where(hidden: false)
                                     .where.not(merchant_name: nil)
                                     .select(:plaid_name, :merchant_name, :category, :raw_data)
                                     .to_a
  end

end
