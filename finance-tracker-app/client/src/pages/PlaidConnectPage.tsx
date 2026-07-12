import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, CreditCard } from "lucide-react";
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  type PlaidConnectionResult,
} from "@/lib/api";

declare global {
  interface Window {
    Plaid: {
      create: (config: PlaidLinkConfig) => { open: () => void; exit: () => void; destroy: () => void };
    };
  }
}

interface PlaidLinkConfig {
  token: string;
  onSuccess: (publicToken: string, metadata: unknown) => void;
  onExit: (error: unknown, metadata: unknown) => void;
  // Fires at EVERY step of the Link flow (OPEN, SELECT_INSTITUTION, OPEN_OAUTH,
  // TRANSITION_VIEW, ERROR, EXIT...). Without this, a failure inside the bank's own
  // OAuth page is completely invisible to us — which is exactly what happened with
  // Chase's 500.
  onEvent?: (eventName: string, metadata: Record<string, unknown>) => void;
}

// Plaid's exit/error payload. `request_id` + `link_session_id` are the important
// bits — they're what you paste into Plaid Dashboard → Activity → Logs to get the
// real server-side reason behind a generic client-side message.
interface PlaidErrorish {
  error_type?: string;
  error_code?: string;
  error_message?: string;
  display_message?: string;
}

type StatusType = 'success' | 'error' | 'info' | null;

// Must match PlaidController::LINKABLE_NAMES. The `name` decides which
// bank_connection row this link writes to — pick the wrong one and you overwrite a
// working connection, so it's an explicit choice, never a default.
const BANKS = [
  { value: 'amex', label: 'American Express' },
  { value: 'hafsa_chase', label: "Chase (Hafsa)" },
];

export default function PlaidConnectPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [bank, setBank] = useState<string>('hafsa_chase');
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: StatusType }>({ message: "", type: null });
  const [logs, setLogs] = useState<string[]>([]);

  const showStatus = (message: string, type: StatusType) => setStatus({ message, type });

  const log = useCallback((line: string) => {
    const stamped = `${new Date().toISOString().slice(11, 19)}  ${line}`;
    // eslint-disable-next-line no-console
    console.log("[plaid]", stamped);
    setLogs((prev) => [...prev, stamped]);
  }, []);

  useEffect(() => {
    if (window.Plaid) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => showStatus("Failed to load Plaid Link", "error");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await createPlaidLinkToken();
        if (!mounted) return;
        if (token) setLinkToken(token);
        else showStatus("Could not get a Plaid link token from the server.", "error");
      } catch (e) {
        if (mounted) showStatus("Failed to get Plaid link token: " + (e as Error).message, "error");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const openPlaid = useCallback(() => {
    if (!scriptLoaded || !window.Plaid) return showStatus("Plaid Link not loaded yet", "error");
    if (!linkToken) return showStatus("No link token yet — try again in a moment.", "error");

    const bankLabel = BANKS.find((b) => b.value === bank)?.label ?? bank;
    setConnecting(true);
    setLogs([]);
    showStatus(`Opening Plaid Link for ${bankLabel}…`, "info");
    log(`open → bank=${bank}`);

    try {
      const handler = window.Plaid.create({
        token: linkToken,

        // Every step of the flow. This is what makes a failure inside the bank's own
        // OAuth page visible instead of a silent dead end.
        onEvent: (eventName, metadata) => {
          const m = (metadata || {}) as Record<string, unknown>;
          const bits = [
            m.view_name && `view=${m.view_name}`,
            m.institution_name && `inst=${m.institution_name}`,
            m.error_code && `error_code=${m.error_code}`,
            m.error_type && `error_type=${m.error_type}`,
            m.error_message && `msg=${m.error_message}`,
            m.request_id && `request_id=${m.request_id}`,
            m.link_session_id && `link_session_id=${m.link_session_id}`,
          ].filter(Boolean).join("  ");
          log(`${eventName}${bits ? "  " + bits : ""}`);
        },

        onSuccess: async (publicToken) => {
          log("SUCCESS → exchanging public_token…");
          try {
            const result: PlaidConnectionResult = await exchangePlaidPublicToken(publicToken, bank);
            log(`exchange OK → bank_connection #${result.bank_connection_id} acct=${result.account_id}`);
            showStatus(
              `${bankLabel} connected (bank_connection #${result.bank_connection_id}). ` +
                `The next sync backfills from where the old provider left off.`,
              "success",
            );
          } catch (e) {
            const message = e as { response?: { data?: { error?: string } }; message?: string };
            const why = message.response?.data?.error || message.message || "Unknown error";
            log(`exchange FAILED → ${why}`);
            showStatus("Server could not save the connection: " + why, "error");
          } finally {
            setConnecting(false);
          }
        },

        onExit: (error, metadata) => {
          const err = (error || {}) as PlaidErrorish;
          const m = (metadata || {}) as Record<string, unknown>;
          if (err.error_code || err.error_message) {
            log(`EXIT with error → code=${err.error_code} type=${err.error_type} msg=${err.error_message}`);
            if (err.display_message) log(`  display: ${err.display_message}`);
          } else {
            log("EXIT (no error — closed by user)");
          }
          if (m.request_id) log(`  request_id=${m.request_id}`);
          if (m.link_session_id) log(`  link_session_id=${m.link_session_id}`);

          showStatus(
            err.display_message || err.error_message
              ? `Plaid Link exited: ${err.display_message || err.error_message}`
              : "Plaid Link closed.",
            err.error_code ? "error" : "info",
          );
          setConnecting(false);
        },
      });
      handler.open();
    } catch (e) {
      log(`create/open threw → ${(e as Error).message}`);
      showStatus("Error: " + (e as Error).message, "error");
      setConnecting(false);
    }
  }, [scriptLoaded, linkToken, bank, log]);

  const StatusIcon = ({ type }: { type: StatusType }) => {
    if (type === "success") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (type === "error") return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (type === "info") return <Info className="h-4 w-4 text-blue-600" />;
    return null;
  };

  const bankLabel = BANKS.find((b) => b.value === bank)?.label ?? bank;

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Connect a bank via Plaid</h1>
        <p className="text-muted-foreground mb-6">
          Plaid's official OAuth. Replaces Teller, which silently served stale data twice.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Link an account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bank">Which account?</Label>
              <select
                id="bank"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                disabled={connecting}
                className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                {BANKS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                This decides which connection is written. Picking the wrong one overwrites a working link.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Sign in to <strong>{bankLabel}</strong> in the Plaid window. The first sync picks up from where the
              previous provider stopped — it will not duplicate what's already recorded. Syncs run every 3 hours.
            </p>

            <Button onClick={openPlaid} className="w-full" disabled={!scriptLoaded || !linkToken || connecting}>
              <CreditCard className="h-4 w-4 mr-2" />
              {connecting ? "Connecting…" : `Connect ${bankLabel}`}
            </Button>

            {status.type && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                status.type === "success" && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
                status.type === "error" && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
                status.type === "info" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              )}>
                <StatusIcon type={status.type} />
                {status.message}
              </div>
            )}

            {logs.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Link event log</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => navigator.clipboard?.writeText(logs.join("\n"))}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="max-h-56 overflow-auto rounded-md border bg-muted/50 p-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
                  {logs.join("\n")}
                </pre>
                <p className="text-[11px] text-muted-foreground">
                  Paste the <code>request_id</code> / <code>link_session_id</code> into
                  Plaid Dashboard → Activity → Logs to get the real server-side reason.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
