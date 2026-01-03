import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, Wrench, Plus, Search } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

declare global {
  interface Window {
    TellerConnect: {
      setup: (config: TellerConnectConfig) => { open: () => void };
    };
  }
}

interface TellerConnectConfig {
  applicationId: string;
  enrollmentId?: string;
  environment: string;
  onSuccess: (enrollment: { accessToken: string; enrollment?: { id: string } }) => void;
  onExit: () => void;
  onFailure: (failure: { message?: string }) => void;
}

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string;
  institution?: { name: string };
}

type StatusType = 'success' | 'error' | 'info' | null;

export default function TellerRepairPage() {
  const [appId, setAppId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [lookupToken, setLookupToken] = useState("");
  const [status, setStatus] = useState<{ message: string; type: StatusType }>({ message: "", type: null });
  const [lookupStatus, setLookupStatus] = useState<{ message: string; type: StatusType }>({ message: "", type: null });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Teller Connect script
  useEffect(() => {
    if (window.TellerConnect) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.teller.io/connect/connect.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setStatus({ message: "Failed to load Teller Connect", type: "error" });
    document.body.appendChild(script);

    return () => {
      // Don't remove - might be needed for future opens
    };
  }, []);

  // Sync accessToken to lookupToken
  useEffect(() => {
    if (accessToken) {
      setLookupToken(accessToken);
    }
  }, [accessToken]);

  const showStatus = (message: string, type: StatusType) => {
    setStatus({ message, type });
  };

  const repairEnrollment = () => {
    if (!appId || !enrollmentId) {
      showStatus("Please enter both Application ID and Enrollment ID", "error");
      return;
    }

    if (!appId.startsWith("app_")) {
      showStatus('Application ID should start with "app_"', "error");
      return;
    }

    if (!enrollmentId.startsWith("enr_")) {
      showStatus('Enrollment ID should start with "enr_"', "error");
      return;
    }

    if (!scriptLoaded || !window.TellerConnect) {
      showStatus("Teller Connect not loaded yet", "error");
      return;
    }

    showStatus("Opening Teller Connect...", "info");

    try {
      const tellerConnect = window.TellerConnect.setup({
        applicationId: appId,
        enrollmentId: enrollmentId,
        environment: "development",
        onSuccess: (enrollment) => {
          setAccessToken(enrollment.accessToken);
          showStatus("Enrollment repaired! Copy the access token above.", "success");
        },
        onExit: () => {
          showStatus("Teller Connect closed.", "info");
        },
        onFailure: (failure) => {
          showStatus("Error: " + (failure.message || "Unknown error"), "error");
        },
      });

      tellerConnect.open();
    } catch (e) {
      showStatus("Error: " + (e as Error).message, "error");
    }
  };

  const createNewEnrollment = () => {
    if (!appId) {
      showStatus("Please enter your Application ID", "error");
      return;
    }

    if (!appId.startsWith("app_")) {
      showStatus('Application ID should start with "app_"', "error");
      return;
    }

    if (!scriptLoaded || !window.TellerConnect) {
      showStatus("Teller Connect not loaded yet", "error");
      return;
    }

    showStatus("Opening Teller Connect for new enrollment...", "info");

    try {
      const tellerConnect = window.TellerConnect.setup({
        applicationId: appId,
        environment: "development",
        onSuccess: (enrollment) => {
          setAccessToken(enrollment.accessToken);
          if (enrollment.enrollment?.id) {
            setEnrollmentId(enrollment.enrollment.id);
          }
          showStatus("New enrollment created! Copy the access token.", "success");
        },
        onExit: () => {
          showStatus("Teller Connect closed.", "info");
        },
        onFailure: (failure) => {
          showStatus("Error: " + (failure.message || "Unknown error"), "error");
        },
      });

      tellerConnect.open();
    } catch (e) {
      showStatus("Error: " + (e as Error).message, "error");
    }
  };

  const lookupAccounts = async () => {
    if (!lookupToken) {
      setLookupStatus({ message: "Please enter a Teller Access Token", type: "error" });
      return;
    }

    setLookupStatus({ message: "Fetching accounts...", type: "info" });

    try {
      const response = await fetch(
        `${API_BASE_URL}/teller/accounts?token=${encodeURIComponent(lookupToken)}`,
        { credentials: "include" }
      );
      const data = await response.json();

      if (!response.ok) {
        setLookupStatus({ message: "Error: " + (data.error || "Unknown error"), type: "error" });
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        setAccounts(data);
        setLookupStatus({ message: `Found ${data.length} account(s)`, type: "success" });
      } else {
        setAccounts([]);
        setLookupStatus({ message: "No accounts found", type: "info" });
      }
    } catch (e) {
      setLookupStatus({ message: "Error: " + (e as Error).message, type: "error" });
    }
  };

  const StatusIcon = ({ type }: { type: StatusType }) => {
    if (type === "success") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (type === "error") return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (type === "info") return <Info className="h-4 w-4 text-blue-600" />;
    return null;
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Teller Enrollment Repair</h1>
        <p className="text-muted-foreground mb-6">Fix disconnected bank connections (MFA required)</p>

        {/* Instructions */}
        <Card className="mb-6 border-l-4 border-l-yellow-500 bg-yellow-50/50">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-yellow-800 mb-2">How to find your credentials:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-900">
              <li>Go to <a href="https://teller.io/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">teller.io/dashboard</a></li>
              <li>Your <strong>Application ID</strong> is shown at the top (starts with <code className="bg-yellow-200 px-1 rounded">app_</code>)</li>
              <li>Click on <strong>Enrollments</strong> in the sidebar</li>
              <li>Find your enrollment and copy the <strong>Enrollment ID</strong> (starts with <code className="bg-yellow-200 px-1 rounded">enr_</code>)</li>
            </ol>
          </CardContent>
        </Card>

        {/* Repair/Create Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Repair or Create Enrollment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="appId">Application ID</Label>
              <Input
                id="appId"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="app_xxxxxxxxxx"
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="enrollmentId">Enrollment ID</Label>
              <Input
                id="enrollmentId"
                value={enrollmentId}
                onChange={(e) => setEnrollmentId(e.target.value)}
                placeholder="enr_xxxxxxxxxx"
                className="font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={repairEnrollment} className="flex-1" disabled={!scriptLoaded}>
                <Wrench className="h-4 w-4 mr-2" />
                Repair Enrollment
              </Button>
              <Button onClick={createNewEnrollment} variant="secondary" className="flex-1" disabled={!scriptLoaded}>
                <Plus className="h-4 w-4 mr-2" />
                New Enrollment
              </Button>
            </div>

            {status.type && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                status.type === "success" && "bg-green-100 text-green-800",
                status.type === "error" && "bg-red-100 text-red-800",
                status.type === "info" && "bg-blue-100 text-blue-800"
              )}>
                <StatusIcon type={status.type} />
                {status.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Access Token Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Access Token</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              After repairing or creating an enrollment, copy the new access token:
            </p>
            <Input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Token will appear here after success"
              className="font-mono"
              readOnly
            />
            <p className="text-xs text-muted-foreground mt-2">
              Update this token in: <code className="bg-muted px-1 rounded">backend/app/lib/teller/api.rb</code>
            </p>
          </CardContent>
        </Card>

        {/* Lookup Accounts Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Lookup Account ID
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Have an access token but need the account ID? Enter it below to fetch account details:
            </p>

            <div>
              <Label htmlFor="lookupToken">Teller Access Token</Label>
              <Input
                id="lookupToken"
                value={lookupToken}
                onChange={(e) => setLookupToken(e.target.value)}
                placeholder="token_xxxxxxxxxx"
                className="font-mono"
              />
            </div>

            <Button onClick={lookupAccounts} variant="secondary" className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Lookup Accounts
            </Button>

            {lookupStatus.type && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                lookupStatus.type === "success" && "bg-green-100 text-green-800",
                lookupStatus.type === "error" && "bg-red-100 text-red-800",
                lookupStatus.type === "info" && "bg-blue-100 text-blue-800"
              )}>
                <StatusIcon type={lookupStatus.type} />
                {lookupStatus.message}
              </div>
            )}

            {accounts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Accounts Found:</h4>
                {accounts.map((acc) => (
                  <div key={acc.id} className="bg-muted p-3 rounded-lg">
                    <div className="font-medium">{acc.name || "Unknown"} ({acc.subtype || acc.type || "account"})</div>
                    <div className="font-mono text-xs text-muted-foreground">Account ID: {acc.id}</div>
                    <div className="text-xs text-muted-foreground">Institution: {acc.institution?.name || "N/A"}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
