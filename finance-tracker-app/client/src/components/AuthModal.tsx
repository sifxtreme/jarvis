import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { setAuthentication } from "../lib/api";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

interface AuthModalProps {
  isOpen: boolean;
  onAuthenticate: () => void;
}

export function AuthModal({ isOpen, onAuthenticate }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSuccess = async (token: string) => {
    setIsLoading(true);
    setError("");
    try {
      setAuthentication(token);
      onAuthenticate();
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to Jarvis</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
              {error}
            </div>
          )}
          <GoogleSignInButton onSuccess={handleSuccess} onError={setError} disabled={isLoading} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
