class Finances::Predictions

  include Utils

  def predict_new_transactions
    transactions = FinancialTransaction.where(reviewed: false, merchant_name: nil, category: nil)
    transactions.each do |f|
      f.merchant_name = predicted_name(f.plaid_name)
      f.category = predicted_category(f.plaid_name)
      f.save!
    end
  end

  private

  def predicted_category(plaid_name)
    normalized_plaid_name = translate_plaid_name(plaid_name)
    prediction = predictable_categories[normalized_plaid_name]

    Rails.logger.info("#{plaid_name} predicted with category: #{prediction}")

    prediction
  end

  def predicted_name(plaid_name)
    normalized_plaid_name = translate_plaid_name(plaid_name)
    prediction = predictable_names[normalized_plaid_name]

    Rails.logger.info("#{plaid_name} predicted with name: #{prediction}")

    prediction
  end

  def predictable_categories
    @predictable_categories ||= category_groupings.to_h do |key, grouping_hash|
      total = grouping_hash[:total]
      prediction = grouping_hash[:group].select { |_, group_count| group_count.to_f / total > 0.5 }.map { |k, _| k }.first
      [key, prediction]
    end.compact
  end

  def predictable_names
    @predictable_names ||= name_groupings.to_h do |key, grouping_hash|
      total = grouping_hash[:total]
      prediction = grouping_hash[:group].select { |_, group_count| group_count.to_f / total > 0.5 }.map { |k, _| k }.first
      [key, prediction]
    end.compact
  end

  def category_groupings
    @category_groupings ||= finances.each_with_object({}) do |curr, acc|
      plaid_name = translate_plaid_name(curr.plaid_name)
      category = curr.category

      if acc[plaid_name] && acc[plaid_name][:group]
        acc[plaid_name][:group][category] = (acc[plaid_name][:group][category] || 0) + 1
      else
        acc[plaid_name] = { group: { category => 1 } }
      end

      acc[plaid_name][:total] = (acc[plaid_name][:total] || 0) + 1
    end
  end

  def name_groupings
    @name_groupings ||= finances.each_with_object({}) do |curr, acc|
      plaid_name = translate_plaid_name(curr.plaid_name)
      merchant_name = curr.merchant_name

      if acc[plaid_name] && acc[plaid_name][:group]
        acc[plaid_name][:group][merchant_name] = (acc[plaid_name][:group][merchant_name] || 0) + 1
      else
        acc[plaid_name] = { group: { merchant_name => 1 } }
      end

      acc[plaid_name][:total] = (acc[plaid_name][:total] || 0) + 1
    end
  end

  def finances
    @finances ||= FinancialTransaction.where(hidden: false)
                                      .where('merchant_name is not NULL')
  end

end
