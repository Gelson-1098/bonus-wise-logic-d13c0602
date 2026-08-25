import type { ReactNode } from "react";
import { Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title = "Nenhum dado encontrado para este período.",
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="rounded-full bg-secondary p-3 text-muted-foreground">
          {icon ?? <Database className="size-6" aria-hidden />}
        </span>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
