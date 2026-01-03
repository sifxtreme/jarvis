import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { createChatMessage, getChatMessages, type ChatMessage as ChatMessageDTO } from "@/lib/api";

type ChatMessage = {
  id: number | string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  pending?: boolean;
};

const mapMessage = (message: ChatMessageDTO): ChatMessage => ({
  id: message.id,
  role: message.role,
  text: message.text || "",
  createdAt: message.created_at,
});

type ChatPanelProps = {
  onEventCreated?: () => void;
};

export function ChatPanel({ onEventCreated }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    const loadMessages = async () => {
      try {
        const response = await getChatMessages();
        if (!mounted) return;
        setMessages(response.map(mapMessage));
      } catch (error) {
        console.error("Failed to load chat messages", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadMessages();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, isSending]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
    setShowJumpToLatest(distanceFromBottom > 140);
  };

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;

    const now = new Date().toISOString();
    const pendingUserId = `pending-user-${Date.now()}`;
    const pendingAssistantId = `pending-assistant-${Date.now()}`;
    const pendingUserMessage: ChatMessage = {
      id: pendingUserId,
      role: "user",
      text: trimmed,
      createdAt: now,
      pending: true,
    };
    const pendingAssistantMessage: ChatMessage = {
      id: pendingAssistantId,
      role: "assistant",
      text: "",
      createdAt: now,
      pending: true,
    };

    setMessages((prev) => [...prev, pendingUserMessage, pendingAssistantMessage]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await createChatMessage(trimmed);
      setMessages((prev) => {
        const withoutPending = prev.filter(
          (message) => message.id !== pendingUserId && message.id !== pendingAssistantId
        );
        return [...withoutPending, mapMessage(response.message), mapMessage(response.reply)];
      });
      if (response.reply.event_created) {
        onEventCreated?.();
      }
    } catch (error) {
      console.error("Failed to send chat message", error);
      setMessages((prev) => {
        const withoutPending = prev.filter(
          (message) => message.id !== pendingUserId && message.id !== pendingAssistantId
        );
        return [
          ...withoutPending,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            text: "Sorry, I couldn't send that message. Try again.",
            createdAt: new Date().toISOString(),
          },
        ];
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const groupedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const groupedWithPrev = prev && prev.role === message.role;
      const groupedWithNext = next && next.role === message.role;
      return { message, groupedWithPrev, groupedWithNext };
    });
  }, [messages]);

  const scrollToLatest = () => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-auto px-4 py-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading chat…</div>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Send event details and I’ll add it to your calendar.
          </div>
        ) : (
          <div>
            {groupedMessages.map(({ message, groupedWithPrev, groupedWithNext }) => {
              const isUser = message.role === "user";
              const timeLabel = new Date(message.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                    groupedWithPrev ? "mt-1" : "mt-4"
                  )}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm shadow-sm",
                        isUser
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100",
                        message.pending && "opacity-70"
                      )}
                    >
                      {message.pending && message.role === "assistant" ? (
                        <div className="flex items-center gap-1">
                          {["0ms", "150ms", "300ms"].map((delay) => (
                            <span
                              key={delay}
                              className="h-2 w-2 rounded-full bg-current/70 animate-pulse"
                              style={{ animationDelay: delay }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.text}</div>
                      )}
                    </div>
                    {!groupedWithNext && (
                      <div
                        className={cn(
                          "mt-1 text-[11px] text-muted-foreground",
                          isUser ? "text-right" : "text-left"
                        )}
                      >
                        {timeLabel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showJumpToLatest && (
          <div className="absolute bottom-4 right-4">
            <Button size="sm" variant="outline" onClick={scrollToLatest}>
              Jump to latest
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={2}
            className="min-h-[56px] flex-1 resize-none"
          />
          <Button type="submit" size="icon" className="shrink-0" disabled={isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Enter to send • Shift+Enter for a new line
        </div>
      </form>
    </div>
  );
}
