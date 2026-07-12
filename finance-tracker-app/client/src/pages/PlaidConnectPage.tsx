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

  const showStatus = (message: string, type: StatusType) => setStatus({ message, type });

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
    showStatus(`Opening Plaid Link for ${bankLabel}…`, "info");

    try {
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken) => {
          try {
            const result: PlaidConnectionResult = await exchangePlaidPublicToken(publicToken, bank);
            showStatus(
              `${bankLabel} connected (bank_connection #${result.bank_connection_id}). ` +
                `The next sync backfills from where the old provider left off.`,
              "success",
            );
          } catch (e) {
            const message = e as { response?: { data?: { error?: string } }; message?: string };
            showStatus(
              "Server could not save the connection: " +
                (message.response?.data?.error || message.message || "Unknown error"),
              "error",
            );
          } finally {
            setConnecting(false);
          }
        },
        onExit: (error) => {
          const err = error as { error_message?: string } | null;
          showStatus(err?.error_message ? `Plaid Link closed: ${err.error_message}` : "Plaid Link closed.", "info");
          setConnecting(false);
        },
      });
      handler.open();
    } catch (e) {
      showStatus("Error: " + (e as Error).message, "error");
      setConnecting(false);
    }
  }, [scriptLoaded, linkToken, bank]);

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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
