module Analysis
  class Finances

    include Utils

    def analyze_new_transactions
      transactions = FinancialTransaction.where(uploaded: false)
      transactions.each do |f|
        f.spreadsheet_name = predicted_name(f.plaid_name)
        f.category = predicted_category(f.plaid_name)
        f.save!

        if f.spreadsheet_name.nil? || f.category.nil?
          Rails.logger.info puts "Transaction #{f.plaid_name} cannot be smartly named OR categorized"
        else
          Rails.logger.info puts "Transaction #{f.plaid_name} analyzed with #{f.spreadsheet_name} AND #{f.category}"
        end

      end
    end

    def predicted_category(plaid_name)
      normalized_plaid_name = translate_plaid_name(plaid_name)
      predicted_hash = predictable_categories[normalized_plaid_name]

      predicted_hash.keys.first if predicted_hash && predicted_hash.count == 1
    end

    def predicted_name(plaid_name)
      normalized_plaid_name = translate_plaid_name(plaid_name)
      predicted_hash = predictable_names[normalized_plaid_name]

      predicted_hash.keys.first if predicted_hash && predicted_hash.count == 1
    end

    def find_problematic_predictions(names, categories)
      names = Hash[names.sort]
      categories = Hash[categories.sort]

      problematic_names = names.select {|k,v| v.size > 1}
      problematic_categories = categories.select {|k,v| v.size > 1}
    end

    private

    def predictable_categories
      @predictable_categories ||= begin
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

    def predictable_names
      @predictable_names ||= begin
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

    def uncategorized_records
      @uncategorized_records ||= FinancialTransaction.select(:plaid_name, :amount).
        where(hidden: 0).
        where('category is NULL').
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month)
    end

    def all_categories
      @all_categories ||= FinancialTransaction.select("category, sum(amount) as total").
        where(hidden: 0).
        where("YEAR(transacted_at) = ?", year).
        where("MONTH(transacted_at) = ?", month).
          group("YEAR(transacted_at), MONTH(transacted_at), category")  
    end
    
  end
end
