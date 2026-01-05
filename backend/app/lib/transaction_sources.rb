module TransactionSources
  ALL = [
    'amex',
    'hafsa_chase',
    'asif_chase',
    'asif_citi',
    'cash',
    'bofa',
    'zelle',
    'venmo'
  ].freeze

  def self.normalize(value)
    value.to_s.strip.downcase
  end

  def self.valid?(value)
    ALL.include?(normalize(value))
  end

  def self.prompt_list
    ALL.join(', ')
  end
end
