import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function PlaidConnectPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: StatusType }>({ message: "", type: null });

  const showStatus = (message: string, type: StatusType) => setStatus({ message, type });

  // Load the Plaid Link script (mirrors TellerRepairPage's Teller Connect load).
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

  // Fetch a link_token from the backend on mount.
  useEffect(() => {
    let mounted = true;
    const loadLinkToken = async () => {
      try {
        const token = await createPlaidLinkToken();
        if (!mounted) return;
        if (token) {
          setLinkToken(token);
        } else {
          showStatus("Could not get a Plaid link token from the server.", "error");
        }
      } catch (e) {
        if (!mounted) return;
        showStatus("Failed to get Plaid link token: " + (e as Error).message, "error");
      }
    };
    loadLinkToken();
    return () => {
      mounted = false;
    };
  }, []);

  const openPlaid = useCallback(() => {
    if (!scriptLoaded || !window.Plaid) {
      showStatus("Plaid Link not loaded yet", "error");
      return;
    }
    if (!linkToken) {
      showStatus("No link token yet — try again in a moment.", "error");
      return;
    }

    setConnecting(true);
    showStatus("Opening Plaid Link for American Express…", "info");

    try {
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken) => {
          try {
            const result: PlaidConnectionResult = await exchangePlaidPublicToken(publicToken);
            showStatus(
              `American Express connected (bank_connection #${result.bank_connection_id}). First sync backfills posted history.`,
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
  }, [scriptLoaded, linkToken]);

  const StatusIcon = ({ type }: { type: StatusType }) => {
    if (type === "success") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (type === "error") return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (type === "info") return <Info className="h-4 w-4 text-blue-600" />;
    return null;
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Connect American Express</h1>
        <p className="text-muted-foreground mb-6">
          Link Amex via Plaid's official OAuth. Replaces the Teller screen-scrape connection.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              American Express (Plaid OAuth)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below, then sign in to American Express in the Plaid window. The first sync
              backfills posted transactions automatically; syncs run every 3 hours after that.
            </p>

            <Button
              onClick={openPlaid}
              className="w-full"
              disabled={!scriptLoaded || !linkToken || connecting}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {connecting ? "Connecting…" : "Connect American Express"}
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
