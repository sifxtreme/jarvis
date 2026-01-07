import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "jarvis_chat_widget_open";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsOpen(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isOpen ? "true" : "false");
  }, [isOpen]);

  const handleEventCreated = () => {
    window.dispatchEvent(new CustomEvent("jarvis:calendar-event-created"));
    window.dispatchEvent(new CustomEvent("jarvis:calendar-changed"));
  };

  if (isMobile || location.pathname === "/chat") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-end justify-end gap-3 sm:bottom-5 sm:right-5 sm:top-auto sm:left-auto",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      <div
        className={cn(
          "w-full transition-all duration-200 sm:w-[420px]",
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <Card className="flex h-[100dvh] flex-col overflow-hidden rounded-none shadow-xl sm:h-[560px] sm:rounded-lg">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jarvis Assistant</div>
              <div className="text-[11px] text-muted-foreground">Ask me anything.</div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel onEventCreated={handleEventCreated} />
          </div>
        </Card>
      </div>

      <Button
        type="button"
        size="lg"
        className={cn("h-12 rounded-full px-5 shadow-lg sm:flex pointer-events-auto", isOpen ? "hidden" : "flex")}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Hide chat" : "Open chat"}
      >
        <MessageCircle className="h-4 w-4" />
        {isOpen ? "Hide chat" : "Chat"}
      </Button>
    </div>
  );
}
