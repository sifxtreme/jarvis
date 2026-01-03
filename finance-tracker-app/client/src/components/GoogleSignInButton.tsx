import { useEffect, useRef, useState } from "react";

type GoogleSignInButtonProps = {
  onSuccess: (token: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      onError?.("Missing VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    const initialize = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onSuccess(response.credential);
          } else {
            onError?.("Google sign-in did not return a credential.");
          }
        },
      });

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: "280",
      });

      setReady(true);
    };

    if (window.google?.accounts?.id) {
      initialize();
      return;
    }

    const existingScript = document.getElementById("google-identity");
    if (existingScript) {
      existingScript.addEventListener("load", initialize, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-identity";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => onError?.("Failed to load Google Identity Services.");
    document.body.appendChild(script);
  }, [disabled, onError, onSuccess]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={buttonRef} />
      {!ready && (
        <p className="text-xs text-muted-foreground">Loading Google Sign-In...</p>
      )}
    </div>
  );
}
