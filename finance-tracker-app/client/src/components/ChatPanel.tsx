import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImagePlus, Send, X } from "lucide-react";
import { API_BASE_URL, createChatMessage, getChatMessages, type ChatMessage as ChatMessageDTO } from "@/lib/api";

type ChatMessage = {
  id: number | string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string | null;
  createdAt: string;
  pending?: boolean;
};

const resolveImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${API_BASE_URL}${imageUrl}`;
};

const mapMessage = (message: ChatMessageDTO): ChatMessage => ({
  id: message.id,
  role: message.role,
  text: message.text || "",
  imageUrl: resolveImageUrl(message.image_url),
  createdAt: message.created_at,
});

type ChatPanelProps = {
  onEventCreated?: () => void;
};

const MAX_IMAGE_DIMENSION = 1568;

const resizeImage = async (file: File, maxDimension = MAX_IMAGE_DIMENSION): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), file.type || "image/jpeg", 0.9)
  );
  if (!blob) return file;

  return new File([blob], file.name, { type: blob.type, lastModified: Date.now() });
};

const dispatchDataRefresh = (action?: string | null) => {
  if (!action) return;
  if (action.startsWith("calendar_event_")) {
    window.dispatchEvent(new CustomEvent("jarvis:calendar-changed"));
  }
  if (action.startsWith("transaction_")) {
    window.dispatchEvent(new CustomEvent("jarvis:transactions-changed"));
  }
};

export function ChatPanel({ onEventCreated }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);

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

  const handleSelectImage = async (file: File | null) => {
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
    }
    if (!file) {
      setSelectedImage(null);
      setSelectedImageUrl(null);
      return;
    }
    setIsPreparingImage(true);
    try {
      const resized = await resizeImage(file);
      setSelectedImage(resized);
      setSelectedImageUrl(URL.createObjectURL(resized));
    } finally {
      setIsPreparingImage(false);
    }
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (isPreparingImage) return;
      const file = acceptedFiles[0];
      if (!file) return;
      await handleSelectImage(file);
    },
    accept: { "image/*": [] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

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
    if ((!trimmed && !selectedImage) || isSending || isPreparingImage) return;

    const now = new Date().toISOString();
    const pendingUserId = `pending-user-${Date.now()}`;
    const pendingAssistantId = `pending-assistant-${Date.now()}`;
    const imageFile = selectedImage;
    const pendingImageUrl = selectedImageUrl;
    const pendingUserMessage: ChatMessage = {
      id: pendingUserId,
      role: "user",
      text: trimmed,
      imageUrl: pendingImageUrl,
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
    setSelectedImage(null);
    setSelectedImageUrl(null);
    setIsSending(true);

    try {
      const response = await createChatMessage(trimmed, imageFile ?? undefined);
      setMessages((prev) => {
        const withoutPending = prev.filter(
          (message) => message.id !== pendingUserId && message.id !== pendingAssistantId
        );
        return [...withoutPending, mapMessage(response.message), mapMessage(response.reply)];
      });
      dispatchDataRefresh(response.reply.action ?? null);
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
      if (pendingImageUrl) {
        URL.revokeObjectURL(pendingImageUrl);
      }
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isPreparingImage) return;
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    await handleSelectImage(file);
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
                        <div className="space-y-2">
                          {message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="Chat upload"
                              className="max-h-64 w-full rounded-lg object-cover"
                            />
                          )}
                          {message.text && <div className="whitespace-pre-wrap">{message.text}</div>}
                        </div>
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
        {isSending && (
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <span>Jarvis is typing</span>
            <span className="flex items-center gap-1">
              {["0ms", "150ms", "300ms"].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 rounded-full bg-current/70 animate-pulse"
                  style={{ animationDelay: delay }}
                />
              ))}
            </span>
          </div>
        )}
        {selectedImageUrl && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <img
              src={selectedImageUrl}
              alt="Selected upload"
              className="h-12 w-12 rounded-md object-cover"
            />
            <div className="flex-1 text-xs text-muted-foreground">
              {isPreparingImage ? "Optimizing image…" : selectedImage?.name || "Selected image"}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => handleSelectImage(null)}
              className="h-8 w-8"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div
          {...getRootProps({
            className: cn(
              "flex items-center gap-2 rounded-lg transition-colors",
              isDragActive && "bg-blue-50 ring-1 ring-blue-200"
            ),
          })}
        >
          <input {...getInputProps()} />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            onClick={open}
            aria-label="Add image"
            disabled={isPreparingImage}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message…"
            rows={3}
            className="min-h-[80px] flex-1 resize-none"
          />
          <Button type="submit" size="icon" className="shrink-0" disabled={isSending || isPreparingImage}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Enter to send • Shift+Enter for a new line • Paste or drag an image
        </div>
      </form>
    </div>
  );
}
