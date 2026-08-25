import { Construction, ArrowRight } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { labelForPath } from "@/lib/navigation";

const STAGES = [
  "Dashboard",
  "Gestão",
  "Execução",
  "Acompanhamento",
  "Resultados",
  "Histórico",
] as const;

/**
 * Layout definitivo de um módulo cuja regra de negócio ainda não foi definida.
 * Não exibe dados fictícios.
 */
export function ModulePlaceholder() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { universe, module } = labelForPath(pathname);

  return (
    <AppShell title={module} description={`${universe} · módulo em preparação`}>
      <div className="space-y-4">
        <EmptyState
          icon={<Construction className="size-6" aria-hidden />}
          title="Módulo em preparação"
          description="A estrutura de navegação e o padrão visual já estão prontos. As regras, formulários e indicadores deste módulo serão liberados na próxima etapa da plataforma."
          action={
            <Button asChild variant="outline">
              <Link to="/remuneracao/mensal/painel">
                Ir para Remuneração Mensal <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Fluxo previsto do módulo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {STAGES.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
                  {stage}
                </span>
                {i < STAGES.length - 1 && (
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                )}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
