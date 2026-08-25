import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, ClipboardList, Users, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { visibleUniverses } from "@/lib/navigation";
import { useAccess } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Plataforma DEX Invest" },
      {
        name: "description",
        content:
          "Visão geral da plataforma DEX Invest: lojas ativas, colaboradores, períodos de remuneração em andamento e acesso aos universos de gestão.",
      },
      { property: "og:title", content: "Dashboard | Plataforma DEX Invest" },
      {
        property: "og:description",
        content: "Painel inicial da plataforma corporativa da DEX Invest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: async () => {
      const [stores, employees, periods, entries] = await Promise.all([
        supabase.from("stores").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("bonus_periods").select("id,status"),
        supabase.from("employee_period_entries").select("approved_value,calculated_value"),
      ]);
      const openPeriods = (periods.data ?? []).filter(
        (p) => p.status !== "fechado" && p.status !== "pago",
      ).length;
      const total = (entries.data ?? []).reduce(
        (acc, e) => acc + Number(e.approved_value ?? e.calculated_value ?? 0),
        0,
      );
      return {
        stores: stores.count ?? 0,
        employees: employees.count ?? 0,
        openPeriods,
        total,
      };
    },
  });

  const universes = visibleUniverses(isMaster).filter((u) => u.id !== "dashboard");

  return (
    <AppShell
      title="Plataforma DEX Invest"
      description="Visão geral dos universos de gestão"
      actions={
        <Button asChild>
          <Link to="/remuneracao/mensal/lancamentos">
            <ClipboardList className="size-4" /> Lançamentos
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Lojas ativas"
            value={data?.stores ?? "—"}
            loading={isLoading}
            hint="Cadastro compartilhado da plataforma"
            icon={<Building2 className="size-[18px]" />}
          />
          <KpiCard
            label="Colaboradores ativos"
            value={data?.employees ?? "—"}
            loading={isLoading}
            hint="Base única de funcionários"
            icon={<Users className="size-[18px]" />}
          />
          <KpiCard
            label="Períodos em andamento"
            value={data?.openPeriods ?? "—"}
            loading={isLoading}
            hint="Remuneração mensal não fechada"
            icon={<ClipboardList className="size-[18px]" />}
          />
          <KpiCard
            label="Remuneração acumulada"
            value={data ? brl(data.total) : "—"}
            loading={isLoading}
            hint="Somatório dos lançamentos apurados"
            icon={<WalletCards className="size-[18px]" />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Universos disponíveis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {universes.map((universe) => {
              const first = universe.items?.[0];
              const ready = universe.id === "remuneracao" || universe.id === "admin";
              return (
                <Link
                  key={universe.id}
                  to={(first?.to ?? universe.base) as never}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <span className="rounded-lg bg-secondary p-2 text-primary">
                    <universe.icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {universe.label}
                      <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {universe.items?.length ?? 0} módulos
                    </span>
                    <span className="mt-2 block">
                      <StatusBadge tone={ready ? "success" : "neutral"}>
                        {ready ? "Disponível" : "Em preparação"}
                      </StatusBadge>
                    </span>
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
