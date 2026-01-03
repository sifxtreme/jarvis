import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateVariant = "loading" | "empty" | "error";

type StateCardProps = {
  title: string;
  description?: string;
  variant?: StateVariant;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function StateCard({
  title,
  description,
  variant = "empty",
  actionLabel,
  onAction,
  className,
}: StateCardProps) {
  return (
    <Card
      className={cn(
        "border border-border/60 bg-background/70 px-4 py-3 shadow-sm",
        variant === "loading" && "animate-pulse",
        variant === "error" && "border-red-500/40 bg-red-50/40 dark:bg-red-950/20",
        className
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      {description && (
        <div className={cn("mt-1 text-sm text-muted-foreground", variant === "error" && "text-red-600 dark:text-red-400")}>
          {description}
        </div>
      )}
      {variant === "loading" && (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      )}
      {actionLabel && onAction && (
        <div className="mt-3">
          <Button size="sm" variant={variant === "error" ? "default" : "outline"} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}
