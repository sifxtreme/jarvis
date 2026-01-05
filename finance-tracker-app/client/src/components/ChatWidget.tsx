import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jarvis_chat_widget_open";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <div
        className={cn(
          "w-[calc(100vw-2.5rem)] max-w-sm transition-all duration-200 sm:w-[380px]",
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <Card className="flex h-[70vh] flex-col overflow-hidden shadow-xl sm:h-[560px]">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jarvis Assistant</div>
              <div className="text-[11px] text-muted-foreground">Ask me to update your calendar or finances.</div>
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
        className="h-12 rounded-full px-5 shadow-lg"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Hide chat" : "Open chat"}
      >
        <MessageCircle className="h-4 w-4" />
        {isOpen ? "Hide chat" : "Chat"}
      </Button>
    </div>
  );
}
