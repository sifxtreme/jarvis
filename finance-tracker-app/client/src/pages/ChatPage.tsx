import { ChatPanel } from "@/components/ChatPanel";
import { Card } from "@/components/ui/card";

export default function ChatPage() {
  return (
    <div className="h-full overflow-hidden p-4 md:p-6">
      <Card className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jarvis Assistant</div>
          <div className="text-[11px] text-muted-foreground">Ask me anything.</div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatPanel />
        </div>
      </Card>
    </div>
  );
}
