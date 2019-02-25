class AnalyzeTransactions

  @queue = :high

  def self.perform
    Finances::Predictions.new.predict_new_transactions
  end

end
