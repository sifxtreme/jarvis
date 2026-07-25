class SyncStatusController < ApplicationController
  # Only the accounts we actually SYNC — not ad-hoc manual entries (zelle/venmo/cash) or
  # old/closed sources. amex auto-syncs via Plaid; chase + bofa come in via CSV drops.
  TRACKED = [
    { source: 'amex',        label: 'Amex',            method: 'plaid' },
    { source: 'hafsa_chase', label: 'Chase (Hafsa)',   method: 'csv'   },
    { source: 'bofa',        label: 'Bank of America', method: 'csv'   },
  ].freeze

  def index
    today = Date.current
    accounts = TRACKED.map do |t|
      newest = FinancialTransaction.where(source: t[:source]).maximum(:transacted_at)
      days = newest ? (today - newest.to_date).to_i : nil
      {
        source: t[:source],
        label: t[:label],
        method: t[:method],
        newest: newest&.to_date&.iso8601,
        days_stale: days,
        status: status_for(t[:method], days),
      }
    end
    render json: { as_of: today.iso8601, accounts: accounts }
  end

  private

  # plaid = auto-syncing, only flag if unusually quiet. csv = a human must drop a file.
  def status_for(method, days)
    return 'unknown' if days.nil?

    if method == 'plaid'
      days <= 5 ? 'ok' : 'check'
    else
      return 'ok'    if days <= 10
      return 'aging' if days <= 21
      'stale'
    end
  end
end
