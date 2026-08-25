import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Info,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "syncing";

const TONE: Record<StatusTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" },
  danger: { icon: XCircle, className: "border-destructive/30 bg-destructive/10 text-destructive" },
  info: { icon: Info, className: "border-info/30 bg-info/10 text-info" },
  neutral: { icon: CircleDashed, className: "border-border bg-muted text-muted-foreground" },
  syncing: { icon: RefreshCw, className: "border-info/30 bg-info/10 text-info" },
};

/** Status sempre com ícone + texto, nunca apenas cor. */
export function StatusBadge({
  tone = "neutral",
  children,
  pending,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  /** usa o ícone de relógio (pendente) mantendo o tom informado */
  pending?: boolean;
  className?: string;
}) {
  const config = TONE[tone];
  const Icon = pending ? Clock3 : config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", tone === "syncing" && !pending && "animate-spin")}
        aria-hidden
      />
      {children}
    </span>
  );
}
