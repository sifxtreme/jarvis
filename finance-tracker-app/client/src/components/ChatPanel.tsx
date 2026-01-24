import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImagePlus, Send, X } from "lucide-react";
import { API_BASE_URL, createChatMessage, getChatMessages, type ChatMessage as ChatMessageDTO } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

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

const MAX_IMAGE_DIMENSION = 1280;
const MAX_UPLOAD_BYTES = 2_500_000;

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

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((result) => resolve(result), file.type || "image/jpeg", quality));

  let blob = await toBlob(0.85);
  if (blob && blob.size > MAX_UPLOAD_BYTES) {
    blob = await toBlob(0.7);
  }
  if (blob && blob.size > MAX_UPLOAD_BYTES) {
    blob = await toBlob(0.55);
  }
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

const linkifyText = (text: string, className: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (!part.match(urlRegex)) {
      return <span key={index}>{part}</span>;
    }
    return (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className={cn("underline underline-offset-2 break-words", className)}
      >
        {part}
      </a>
    );
  });
};

const renderMessageText = (text: string, linkClassName: string) => {
  const lines = text.split("\n");
  const header = lines[0]?.trim() || "";
  const isListHeader =
    header.startsWith("Here are the next matches:") || header.startsWith("Here are the next events:");

  if (isListHeader) {
    return (
      <div className="space-y-2">
        <div className="font-medium">{linkifyText(header, linkClassName)}</div>
        <ul className="space-y-1">
          {lines.slice(1).filter(Boolean).map((line, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400/80 dark:bg-slate-500" />
              <span className="flex-1">{linkifyText(line.trim(), linkClassName)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <div className="whitespace-pre-wrap">{linkifyText(text, linkClassName)}</div>;
};

export function ChatPanel({ onEventCreated }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Snapshot for scroll restoration
  const scrollSnapshotRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const isInitialLoadRef = useRef(true);

  const scrollToBottom = (instant = false) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: instant ? "auto" : "smooth",
    });
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
  };

  useEffect(() => {
    let mounted = true;
    const loadMessages = async () => {
      try {
        const response = await getChatMessages({ limit: 10 });
        if (!mounted) return;
        setMessages((response.messages || []).map(mapMessage));
        setHasMore(Boolean(response.has_more));
        setBeforeId(response.next_before_id ?? null);
      } catch (error) {
        logger.error("Chat", "Failed to load chat messages", error);
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
      if (resized.size > MAX_UPLOAD_BYTES) {
        toast({
          title: "Image too large",
          description: "Try a smaller image to upload.",
          variant: "destructive",
        });
        setSelectedImage(null);
        setSelectedImageUrl(null);
        return;
      }
      setSelectedImage(resized);
      setSelectedImageUrl(URL.createObjectURL(resized));
    } finally {
      setIsPreparingImage(false);
    }
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles: File[]) => {
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

  // Handle scroll positioning with useLayoutEffect to prevent jumps
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (scrollSnapshotRef.current) {
      // Restore scroll position after loading older messages
      const { scrollHeight: prevScrollHeight, scrollTop: prevScrollTop } = scrollSnapshotRef.current;
      const nextScrollHeight = container.scrollHeight;
      container.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
      scrollSnapshotRef.current = null;
    } else if (shouldAutoScrollRef.current) {
      // Scroll to bottom for new messages or initial load
      scrollToBottom(isInitialLoadRef.current);
      if (messages.length > 0) {
        isInitialLoadRef.current = false;
      }
    }
  }, [messages.length, isSending]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    
    // Check if we are near top to load more
    if (container.scrollTop < 80 && hasMore && !isLoadingMore && !isLoading) {
      void loadOlderMessages();
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
    setShowJumpToLatest(distanceFromBottom > 140);
  };

  const loadOlderMessages = async () => {
    if (!beforeId) return;
    const container = scrollRef.current;
    if (!container) return;
    
    // Capture snapshot before fetching
    scrollSnapshotRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    };
    
    setIsLoadingMore(true);
    try {
      const response = await getChatMessages({ limit: 10, beforeId });
      const older = (response.messages || []).map(mapMessage);
      
      setMessages((prev) => [...older, ...prev]);
      setHasMore(Boolean(response.has_more));
      setBeforeId(response.next_before_id ?? null);
      
      // Note: Scroll restoration happens in useLayoutEffect
    } catch (error) {
      logger.error("Chat", "Failed to load older chat messages", error);
      scrollSnapshotRef.current = null; // Clear snapshot on error
    } finally {
      setIsLoadingMore(false);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft]);

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
    shouldAutoScrollRef.current = true; // Force scroll to bottom

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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
      logger.error("Chat", "Failed to send chat message", error);
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
    scrollToBottom(false);
  };

  return (
    <div className="flex min-h-0 h-full flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-auto px-4 py-3">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {["0ms", "150ms", "300ms"].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
                  style={{ animationDelay: delay }}
                />
              ))}
            </div>
            <span>Loading chat…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="mb-2 text-lg font-medium text-foreground">Welcome to Jarvis</div>
            <p className="max-w-xs text-sm">Send event details and I’ll add it to your calendar, or ask about your finances.</p>
          </div>
        ) : (
          <div>
            {isLoadingMore && (
              <div className="mb-4 flex justify-center">
                <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                  <div className="flex items-center gap-1">
                    {["0ms", "150ms", "300ms"].map((delay) => (
                      <span
                        key={delay}
                        className="h-1 w-1 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: delay }}
                      />
                    ))}
                  </div>
                  <span>Loading history</span>
                </div>
              </div>
            )}
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
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        isUser
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-border/50 rounded-bl-sm",
                        message.pending && "opacity-70"
                      )}
                    >
                      {message.pending && message.role === "assistant" ? (
                        <div className="flex items-center gap-1 py-1">
                          {["0ms", "150ms", "300ms"].map((delay) => (
                            <span
                              key={delay}
                              className="h-2 w-2 rounded-full bg-slate-400/80 animate-bounce"
                              style={{ animationDelay: delay }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {message.imageUrl && (
                            <button
                              type="button"
                              className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-black/5"
                              onClick={() => setPreviewImageUrl(message.imageUrl ?? null)}
                              aria-label="Preview image"
                            >
                              <img
                                src={message.imageUrl}
                                alt="Chat upload"
                                className="max-h-64 w-full object-cover"
                                onLoad={() => {
                                  if (shouldAutoScrollRef.current) {
                                    scrollToBottom(true);
                                  }
                                }}
                              />
                            </button>
                          )}
                          {message.text &&
                            renderMessageText(
                              message.text,
                              isUser
                                ? "text-white/95 decoration-white/80"
                                : "text-blue-600 dark:text-blue-400"
                            )}
                        </div>
                      )}
                    </div>
                    {!groupedWithNext && (
                      <div
                        className={cn(
                          "mt-1 text-[10px] text-muted-foreground/80",
                          isUser ? "text-right mr-1" : "text-left ml-1"
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
          <div className="absolute bottom-4 right-4 z-10">
            <Button size="sm" variant="secondary" className="shadow-md rounded-full h-8 px-3 text-xs" onClick={scrollToLatest}>
              Jump to latest
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 bg-background/50 p-4 backdrop-blur-sm">
        <form onSubmit={handleSend} className="relative">
          {selectedImageUrl && (
            <div className="absolute bottom-full left-0 mb-2 flex items-center gap-3 rounded-xl border border-border/60 bg-background p-2 shadow-sm">
              <img
                src={selectedImageUrl}
                alt="Selected upload"
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="flex-1 text-xs text-muted-foreground">
                {isPreparingImage ? "Optimizing image…" : selectedImage?.name || "Selected image"}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => handleSelectImage(null)}
                className="h-6 w-6 rounded-full hover:bg-muted"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div
            {...getRootProps({
              className: cn(
                "flex items-end gap-2 rounded-2xl border border-border/60 bg-background px-2 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring/50 transition-all",
                isDragActive && "bg-blue-50/50 ring-2 ring-blue-500/20"
              ),
            })}
          >
            <input {...getInputProps()} />
            
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={open}
              aria-label="Add image"
              disabled={isPreparingImage}
            >
              <ImagePlus className="h-5 w-5" />
            </Button>

            <Textarea
              ref={(e) => {
                textareaRef.current = e;
              }}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message…"
              rows={1}
              className="min-h-[20px] flex-1 resize-none border-0 bg-transparent p-2 focus-visible:ring-0 shadow-none text-base sm:text-sm"
              style={{ maxHeight: "200px" }}
            />

            <Button 
              type="submit" 
              size="icon" 
              className={cn(
                "h-9 w-9 shrink-0 rounded-xl transition-all", 
                (!draft.trim() && !selectedImage) ? "opacity-50" : "opacity-100"
              )}
              disabled={isSending || isPreparingImage || (!draft.trim() && !selectedImage)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              {isSending ? (
                <>
                   <span>Jarvis is typing</span>
                    <span className="flex items-center gap-0.5">
                      {["0ms", "150ms", "300ms"].map((delay) => (
                        <span
                          key={delay}
                          className="h-1 w-1 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: delay }}
                        />
                      ))}
                    </span>
                </>
              ) : (
                <span>Enter to send, Shift+Enter for new line</span>
              )}
            </div>
          </div>
        </form>
      </div>

      <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="w-auto max-w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-transparent border-0 shadow-none place-items-center flex justify-center items-center">
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt="Chat preview"
              className="max-h-[85vh] w-auto max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
