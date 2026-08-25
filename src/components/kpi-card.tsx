import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type TrendDirection = "up" | "down" | "flat";

/**
 * Tendência com ícone + texto + cor. `lowerIsBetter` inverte a leitura
 * para indicadores como cancelamentos, onde a queda é positiva.
 */
export function TrendIndicator({
  changePct,
  lowerIsBetter = false,
  comparisonLabel,
  className,
}: {
  changePct: number | null | undefined;
  lowerIsBetter?: boolean;
  comparisonLabel?: string;
  className?: string;
}) {
  if (changePct === null || changePct === undefined || Number.isNaN(changePct)) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground", className)}>
        <Minus className="size-4" aria-hidden /> sem comparação
      </span>
    );
  }

  const direction: TrendDirection = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : lowerIsBetter ? direction === "down" : direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const tone =
    good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive";
  const formatted = `${changePct > 0 ? "+" : ""}${changePct.toFixed(1).replace(".", ",")}%`;

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", tone, className)}>
      <Icon className="size-4" aria-hidden />
      {formatted}
      {comparisonLabel && (
        <span className="font-normal text-muted-foreground">{comparisonLabel}</span>
      )}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  changePct,
  lowerIsBetter,
  comparisonLabel = "vs. período anterior",
  hint,
  loading,
  icon,
}: {
  label: string;
  value: ReactNode;
  changePct?: number | null;
  lowerIsBetter?: boolean;
  comparisonLabel?: string;
  hint?: string;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Card className="transition-colors hover:bg-secondary/60">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        )}
        {loading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <div className="space-y-1">
            {changePct !== undefined && (
              <TrendIndicator
                changePct={changePct}
                {...(lowerIsBetter !== undefined ? { lowerIsBetter } : {})}
              />
            )}
            <p className="text-xs text-muted-foreground">{hint ?? comparisonLabel}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiCardSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCard key={i} label="—" value="—" loading />
      ))}
    </div>
  );
}
