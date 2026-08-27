import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker } from "@/components/period-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, pct, PERIOD_STATUS_LABEL, statusTone, periodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/remuneracao/mensal/painel")({
  head: () => ({
    meta: [
      { title: "Painel executivo | PRISMA" },
      {
        name: "description",
        content:
          "Acompanhe atingimento de metas, elegibilidade e valores de bônus por loja em cada competência.",
      },
      { property: "og:title", content: "Painel executivo | PRISMA" },
      { property: "og:description", content: "Acompanhe atingimento de metas, elegibilidade e valores de bônus por loja em cada competência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelPage,
});

type PeriodRow = {
  id: string;
  status: string;
  month: number;
  year: number;
  stores: { name: string } | null;
  store_targets: {
    target_calculated: number | null;
    target_adjusted: number | null;
    revenue_actual: number | null;
  }[];
  employee_period_entries: {
    calculated_value: number;
    approved_value: number | null;
    result_status: string;
  }[];
};

function PainelPage() {
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  const { data, isLoading } = useQuery({
    queryKey: ["painel", period.month, period.year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_periods")
        .select(
          "id,status,month,year,stores(name),store_targets(target_calculated,target_adjusted,revenue_actual),employee_period_entries(calculated_value,approved_value,result_status)",
        )
        .eq("month", period.month)
        .eq("year", period.year);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PeriodRow[];
    },
  });

  const rows = useMemo(() => {
    return (data ?? [])
      .map((p) => {
        const t = p.store_targets[0];
        const target = t?.target_adjusted ?? t?.target_calculated ?? null;
        const revenue = t?.revenue_actual ?? null;
        const attainment = target && Number(target) > 0 && revenue !== null ? (Number(revenue) / Number(target)) * 100 : null;
        const total = p.employee_period_entries.reduce(
          (s, e) => s + Number(e.approved_value ?? e.calculated_value ?? 0),
          0,
        );
        return {
          id: p.id,
          store: p.stores?.name ?? "—",
          status: p.status,
          target: target === null ? null : Number(target),
          revenue: revenue === null ? null : Number(revenue),
          attainment,
          total,
          employees: p.employee_period_entries.length,
          paying: p.employee_period_entries.filter((e) => Number(e.approved_value ?? e.calculated_value) > 0).length,
        };
      })
      .sort((a, b) => a.store.localeCompare(b.store));
  }, [data]);

  const totals = rows.reduce(
    (acc, r) => ({
      target: acc.target + (r.target ?? 0),
      revenue: acc.revenue + (r.revenue ?? 0),
      bonus: acc.bonus + r.total,
      employees: acc.employees + r.employees,
      paying: acc.paying + r.paying,
    }),
    { target: 0, revenue: 0, bonus: 0, employees: 0, paying: 0 },
  );
  const globalAttainment = totals.target > 0 ? (totals.revenue / totals.target) * 100 : null;

  const eligibleCount = rows.filter((r) => r.attainment !== null && r.attainment >= 90).length;
  const ineligibleCount = rows.filter((r) => r.attainment !== null && r.attainment < 90).length;

  return (
    <AppShell
      title="Painel executivo"
      description={`Competência ${periodLabel(period.month, period.year)}`}
      actions={<PeriodPicker month={period.month} year={period.year} onChange={setPeriod} />}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Faturamento realizado" value={brl(totals.revenue)} hint={`Meta total ${brl(totals.target)}`} />
        <Kpi
          label="Lojas Elegíveis (≥ 90%)"
          value={`${eligibleCount} de ${rows.length}`}
          hint={
            ineligibleCount > 0
              ? `${ineligibleCount} loja(s) inelegível(is) (< 90%)`
              : "Todas as lojas apuradas atingiram o gatilho"
          }
        />
        <Kpi
          label="Atingimento consolidado"
          value={pct(globalAttainment)}
          hint={globalAttainment === null ? "Metas não lançadas" : globalAttainment >= 90 ? "Acima do gatilho (Elegível)" : "Abaixo do gatilho (Inelegível)"}
        />
        <Kpi label="Bônus do período" value={brl(totals.bonus)} hint={`${totals.paying} colaboradores a receber`} />
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">Bônus por loja</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum período aberto nesta competência.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((r) => ({ name: r.store, bonus: r.total }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => brl(Number(v))} />
                <Bar dataKey="bonus" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por loja e elegibilidade</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Atingimento</TableHead>
                  <TableHead className="text-center">Elegibilidade Bônus</TableHead>
                  <TableHead className="text-right">Colaboradores</TableHead>
                  <TableHead className="text-right">Bônus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Abra o período em “Lançamento” para começar.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const isEligible = r.attainment !== null ? r.attainment >= 90 : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.store}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(statusTone(r.status))}>
                          {PERIOD_STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.target === null ? "—" : brl(r.target)}</TableCell>
                      <TableCell className="text-right">{r.revenue === null ? "—" : brl(r.revenue)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-bold",
                          r.attainment !== null && r.attainment < 90 && "text-destructive",
                          r.attainment !== null && r.attainment >= 90 && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {pct(r.attainment)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEligible === true && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]">
                            ELEGÍVEL
                          </Badge>
                        )}
                        {isEligible === false && (
                          <Badge variant="destructive" className="font-bold text-[11px]">
                            INELEGÍVEL
                          </Badge>
                        )}
                        {isEligible === null && <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.paying}/{r.employees}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{brl(r.total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
