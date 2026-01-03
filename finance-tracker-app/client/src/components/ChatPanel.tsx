import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImagePlus, Send } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  imageUrl?: string;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Drop an image, paste a screenshot, or type a message to get started.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) await addImageMessage(file);
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const addImageMessage = async (file: File) => {
    const imageUrl = await readFileAsDataUrl(file);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-image`,
        role: "user",
        imageUrl,
      },
    ]);
  };

  const handleSend = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-text`,
        role: "user",
        text: trimmed,
      },
    ]);
    setDraft("");
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await addImageMessage(file);
    }
  };

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3">
        <div className="space-y-4">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    isUser
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                  )}
                >
                  {message.text && <div className="whitespace-pre-wrap">{message.text}</div>}
                  {message.imageUrl && (
                    <img
                      src={message.imageUrl}
                      alt="Uploaded"
                      className="mt-2 max-h-48 rounded-lg object-cover"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSend} className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message…"
            rows={1}
            className="min-h-[44px] resize-none"
          />
          <Button type="submit" size="sm" className="shrink-0">
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await addImageMessage(file);
            event.target.value = "";
          }}
        />
      </form>
    </div>
  );
}
