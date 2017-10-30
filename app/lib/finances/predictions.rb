module Finances
  class Predictions

    include Utils

    def predict_new_transactions
      transactions = FinancialTransaction.where(uploaded: false)
      transactions.each do |f|
        f.spreadsheet_name = predicted_name(f.plaid_name)
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
      @predictable_categories ||= begin
        category_groupings.select do |k,v| 
          v.count == 1
        end.map do |k,v| 
          [k,v.keys.first]
        end.to_h
      end
    end

    def predictable_names
      @predictable_names ||= begin
        name_groupings.select do |k,v| 
          v.count == 1
        end.map do |k,v| 
          [k,v.keys.first]
        end.to_h
      end
    end

    def category_groupings
      @category_groupings ||= begin
        categories = {}

        finances.each do |f|
          plaid_name = f.plaid_name

          if categories[translate_plaid_name(plaid_name)]
            if categories[translate_plaid_name(plaid_name)][f.category]
              categories[translate_plaid_name(plaid_name)][f.category] += 1
            else
              categories[translate_plaid_name(plaid_name)][f.category] = 1
            end
          else
            categories[translate_plaid_name(plaid_name)] = {"#{f.category}" => 1}
          end
        end

        categories
      end
    end

    def name_groupings
      @name_groupings ||= begin
        names = {}

        finances.each do |f|
          plaid_name = f.plaid_name

          if names[translate_plaid_name(plaid_name)]
            if names[translate_plaid_name(plaid_name)][f.spreadsheet_name]
              names[translate_plaid_name(plaid_name)][f.spreadsheet_name] += 1
            else
              names[translate_plaid_name(plaid_name)][f.spreadsheet_name] = 1
            end
          else
            names[translate_plaid_name(plaid_name)] = {"#{f.spreadsheet_name}" => 1}
          end
        end

        names
      end
    end

    def finances
      @finances ||= FinancialTransaction.where(hidden: 0).
        where("spreadsheet_name is not NULL")
    end

  end
end
