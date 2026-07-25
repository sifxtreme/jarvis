import { useEffect, useState } from 'react';
import { getSyncStatus, type SyncAccount } from '@/lib/api';

const STATUS: Record<string, { dot: string; label: string; hint: string }> = {
  ok:      { dot: 'bg-green-500', label: 'Synced',     hint: '' },
  aging:   { dot: 'bg-amber-500', label: 'Aging',      hint: 'Drop a CSV soon' },
  stale:   { dot: 'bg-red-500',   label: 'Needs sync', hint: 'Drop a CSV' },
  check:   { dot: 'bg-amber-500', label: 'Check',      hint: 'Unusually quiet — verify the connection' },
  unknown: { dot: 'bg-muted',     label: 'No data',    hint: '' },
};

const METHOD: Record<string, string> = { plaid: 'Auto (Plaid)', csv: 'CSV drop' };

export default function SyncStatusPage() {
  const [data, setData] = useState<{ as_of: string; accounts: SyncAccount[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSyncStatus().then(setData).catch((e) => setError(e?.message ?? 'Failed to load'));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold mb-1">Sync status</h1>
      <p className="text-xs text-muted-foreground mb-4">
        The accounts we actually sync — Amex auto-syncs; Chase &amp; BofA come in via CSV.
        {data ? ` As of ${data.as_of}.` : ''}
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-2">
        {data?.accounts.map((a) => {
          const s = STATUS[a.status] ?? STATUS.unknown;
          return (
            <div
              key={a.source}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                <div>
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {METHOD[a.method] ?? a.method} · last {a.newest ?? '—'}
                    {a.days_stale != null ? ` (${a.days_stale}d ago)` : ''}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{s.label}</div>
                {s.hint && <div className="text-xs text-muted-foreground">{s.hint}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
