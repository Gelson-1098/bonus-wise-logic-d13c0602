import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateGoals,
  getGoalGrowth,
  importRevenueHistory,
  saveGoalGrowth,
  syncOfficialPdfGoals,
  updateStoreGoalManual,
} from "@/lib/goals.functions";
import {
  buildRows,
  COLUMN_HINTS,
  duplicateKeys,
  guessColumn,
  normalize,
  type ColumnMap,
  type ParsedRow,
} from "@/lib/goal-import";
import { AppShell } from "@/components/app-shell";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { brl, MONTHS, periodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/remuneracao/mensal/metas")({
  head: () => ({
    meta: [
      { title: "Orçamento de Metas | PRISMA" },
      {
        name: "description",
        content:
          "Orçamento oficial de metas por loja e mês: faturamento e clientes atendidos (TC) com base no ano anterior + 10%.",
      },
      { property: "og:title", content: "Orçamento de Metas | PRISMA" },
      {
        property: "og:description",
        content:
          "Orçamento oficial de metas por loja e mês: faturamento e clientes atendidos (TC) com base no ano anterior + 10%.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetasPage,
});

const intFmt = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const PDF_MONTHS = [
  { month: 6, label: "JUN", full: "Junho" },
  { month: 7, label: "JUL", full: "Julho" },
  { month: 8, label: "AGO", full: "Agosto" },
  { month: 9, label: "SET", full: "Setembro" },
  { month: 10, label: "OUT", full: "Outubro" },
  { month: 11, label: "NOV", full: "Novembro" },
  { month: 12, label: "DEZ", full: "Dezembro" },
];

function MetasPage() {
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;

  return (
    <AppShell
      title="Orçamento de Metas"
      description={
        isMaster
          ? "Orçamento oficial por loja e mês — base do ano anterior + 10% (Edição exclusiva Master)"
          : "Orçamento oficial de metas da sua loja — base do ano anterior + 10% (Somente leitura)"
      }
    >
      {isMaster ? <MasterMetas /> : <ManagerMetas />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ Master View */

function MasterMetas() {
  return (
    <Tabs defaultValue="orcamento" className="space-y-4">
      <TabsList>
        <TabsTrigger value="orcamento">Orçamento de Metas (Matriz)</TabsTrigger>
        <TabsTrigger value="detalhado">Visão Analítica</TabsTrigger>
        <TabsTrigger value="importar">Importar Planilha</TabsTrigger>
        <TabsTrigger value="config">Parâmetros de Crescimento</TabsTrigger>
      </TabsList>
      <TabsContent value="orcamento">
        <BudgetMatrixView isMaster={true} />
      </TabsContent>
      <TabsContent value="detalhado">
        <GoalsDashboard isMaster={true} />
      </TabsContent>
      <TabsContent value="importar">
        <ImportWizard />
      </TabsContent>
      <TabsContent value="config">
        <GrowthSettings />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ Manager View */

function ManagerMetas() {
  return (
    <div className="space-y-6">
      <BudgetMatrixView isMaster={false} />
    </div>
  );
}

function useStores() {
  return useQuery({
    queryKey: ["stores-metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id,name,code,active").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/* -------------------------------------------------- Matriz Consolidada de Orçamento */

type EditGoalPayload = {
  goalId: string;
  storeName: string;
  storeId: string;
  year: number;
  month: number;
  faturamentoBase: number;
  metaFaturamento: number;
  tcBase: number;
  metaTc: number;
};

function BudgetMatrixView({ isMaster }: { isMaster: boolean }) {
  const qc = useQueryClient();
  const syncPdf = useServerFn(syncOfficialPdfGoals);
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [metric, setMetric] = useState<"faturamento" | "tc">("faturamento");
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<EditGoalPayload | null>(null);

  const { data: stores, isLoading: loadingStores } = useStores();

  const goalsQuery = useQuery({
    queryKey: ["store-goals", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_goals")
        .select(
          "id,store_id,year,month,base_year,faturamento_base_ano_anterior,meta_faturamento,tc_ano_anterior,meta_tc,growth_fat_pct,growth_tc_pct,version,stores(name)",
        )
        .eq("year", year)
        .order("month");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const actualsQuery = useQuery({
    queryKey: ["actuals-targets", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_periods")
        .select("id,store_id,month,year,store_targets(revenue_actual,tc_actual)")
        .eq("year", year);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const actualMap = useMemo(() => {
    const m = new Map<string, { revenue_actual: number | null; tc_actual: number | null }>();
    for (const p of actualsQuery.data ?? []) {
      const t = p.store_targets as unknown as { revenue_actual: number | null; tc_actual: number | null } | null;
      if (t) m.set(`${p.store_id}-${p.month}`, t);
    }
    return m;
  }, [actualsQuery.data]);

  const syncPdfMutation = useMutation({
    mutationFn: async () => syncPdf({}),
    onSuccess: (res) => {
      toast.success("Orçamento oficial carregado!", {
        description: `${res.storesCount} lojas sincronizadas e ${res.goalsGenerated} metas geradas para ${year} com base no PDF oficial (+10%).`,
      });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Falha ao sincronizar", { description: e.message }),
  });

  // Mapeamento: chave = "storeId-month" -> Goal
  const goalMap = useMemo(() => {
    const m = new Map<string, (typeof goalsQuery.data)[number]>();
    for (const g of goalsQuery.data ?? []) {
      m.set(`${g.store_id}-${g.month}`, g);
    }
    return m;
  }, [goalsQuery.data]);

  // Lista de lojas ativas
  const activeStores = useMemo(() => {
    return (stores ?? []).filter((s) => s.active);
  }, [stores]);

  // Totais por mês
  const monthlyTotals = useMemo(() => {
    const totals: Record<number, { baseFat: number; metaFat: number; baseTc: number; metaTc: number }> = {};
    for (const pm of PDF_MONTHS) {
      totals[pm.month] = { baseFat: 0, metaFat: 0, baseTc: 0, metaTc: 0 };
    }
    for (const g of goalsQuery.data ?? []) {
      if (totals[g.month]) {
        totals[g.month]!.baseFat += Number(g.faturamento_base_ano_anterior);
        totals[g.month]!.metaFat += Number(g.meta_faturamento);
        totals[g.month]!.baseTc += Number(g.tc_ano_anterior);
        totals[g.month]!.metaTc += Number(g.meta_tc);
      }
    }
    return totals;
  }, [goalsQuery.data]);

  const totalPeriodMeta = useMemo(() => {
    return (goalsQuery.data ?? []).reduce(
      (acc, g) => ({
        metaFat: acc.metaFat + Number(g.meta_faturamento),
        baseFat: acc.baseFat + Number(g.faturamento_base_ano_anterior),
        metaTc: acc.metaTc + Number(g.meta_tc),
        baseTc: acc.baseTc + Number(g.tc_ano_anterior),
      }),
      { metaFat: 0, baseFat: 0, metaTc: 0, baseTc: 0 },
    );
  }, [goalsQuery.data]);

  return (
    <div className="space-y-5">
      {/* Barra de Ações e Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ano do Orçamento</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[120px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[nowYear - 1, nowYear, nowYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Indicador Visualizado</Label>
              <div className="flex rounded-md border p-0.5 bg-muted/30">
                <Button
                  size="sm"
                  variant={metric === "faturamento" ? "default" : "ghost"}
                  className="h-8 text-xs font-semibold"
                  onClick={() => setMetric("faturamento")}
                >
                  Faturamento (R$)
                </Button>
                <Button
                  size="sm"
                  variant={metric === "tc" ? "default" : "ghost"}
                  className="h-8 text-xs font-semibold"
                  onClick={() => setMetric("tc")}
                >
                  TC (Clientes)
                </Button>
              </div>
            </div>
          </div>

          {isMaster ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
                onClick={() => syncPdfMutation.mutate()}
                disabled={syncPdfMutation.isPending}
              >
                <Sparkles className="size-4 text-primary mr-1" />
                {syncPdfMutation.isPending ? "Sincronizando..." : "Carregar Orçamento Oficial do PDF"}
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="px-3 py-1 bg-muted/40 text-muted-foreground text-xs">
              🔒 Orçamento Oficial Fixado (Somente Leitura)
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {metric === "faturamento" ? "Orçamento Total Faturamento" : "Orçamento Total TC"}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
              {metric === "faturamento" ? brl(totalPeriodMeta.metaFat) : intFmt(totalPeriodMeta.metaTc)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Meta consolidada de Junho a Dezembro ({year})</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {metric === "faturamento" ? `Realizado Ano Anterior (${year - 1})` : `TC Ano Anterior (${year - 1})`}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {metric === "faturamento" ? brl(totalPeriodMeta.baseFat) : intFmt(totalPeriodMeta.baseTc)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Base oficial do PDF</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Crescimento Orçado</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              + 10,00%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Meta = Base do Ano Anterior × 110%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Gatilho de Elegibilidade</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">90,00%</p>
            <p className="mt-1 text-xs text-muted-foreground">Atingimento ≥ 90% libera bônus integral</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Matriz Consolidada */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span>
                Orçamento Oficial de Metas {year} — {metric === "faturamento" ? "Faturamento (R$)" : "TC (Clientes)"}
              </span>
            </CardTitle>
            <CardDescription>
              Valores calculados com base no ano anterior ({year - 1}) + 10%. Clique na loja para expandir o detalhamento completo.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 font-semibold">
                  <TableHead className="w-[200px]">Loja</TableHead>
                  {PDF_MONTHS.map((pm) => (
                    <TableHead key={pm.month} className="text-right">
                      {pm.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-bold text-primary">TOTAL PERÍODO</TableHead>
                  <TableHead className="text-center w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStores && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                      Carregando orçamento...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingStores && activeStores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                      Nenhuma loja ativa cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {activeStores.map((s) => {
                  let storeTotal = 0;
                  const isExpanded = expandedStoreId === s.id;

                  return (
                    <ReactFragment key={s.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/30 transition-colors",
                          isExpanded && "bg-muted/20 border-l-4 border-l-primary",
                        )}
                        onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                      >
                        <TableCell className="font-semibold flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-primary" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                          <span>{s.name}</span>
                        </TableCell>

                        {PDF_MONTHS.map((pm) => {
                          const goal = goalMap.get(`${s.id}-${pm.month}`);
                          const val = goal
                            ? metric === "faturamento"
                              ? Number(goal.meta_faturamento)
                              : Number(goal.meta_tc)
                            : 0;
                          storeTotal += val;

                          return (
                            <TableCell key={pm.month} className="text-right font-medium text-xs sm:text-sm">
                              {val > 0 ? (
                                metric === "faturamento" ? (
                                  brl(val)
                                ) : (
                                  intFmt(val)
                                )
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}

                        <TableCell className="text-right font-bold text-primary">
                          {storeTotal > 0 ? (
                            metric === "faturamento" ? (
                              brl(storeTotal)
                            ) : (
                              intFmt(storeTotal)
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                          >
                            {isExpanded ? "Ocultar" : "Detalhar"}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Linha Expandida com Detalhamento Completo da Loja */}
                      {isExpanded && (
                        <TableRow className="bg-muted/10">
                          <TableCell colSpan={10} className="p-4">
                            <StoreDetailCard
                              storeId={s.id}
                              storeName={s.name}
                              year={year}
                              goalMap={goalMap}
                              actualMap={actualMap}
                              isMaster={isMaster}
                              onEditGoal={(payload) => setEditingGoal(payload)}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </ReactFragment>
                  );
                })}

                {/* Linha de Totais Gerais */}
                {activeStores.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell>TOTAL CONSOLIDADO</TableCell>
                    {PDF_MONTHS.map((pm) => {
                      const mTot = monthlyTotals[pm.month];
                      const val = metric === "faturamento" ? mTot?.metaFat ?? 0 : mTot?.metaTc ?? 0;
                      return (
                        <TableCell key={pm.month} className="text-right font-bold">
                          {val > 0 ? (metric === "faturamento" ? brl(val) : intFmt(val)) : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-extrabold text-primary">
                      {metric === "faturamento" ? brl(totalPeriodMeta.metaFat) : intFmt(totalPeriodMeta.metaTc)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Edição Exclusivo para o Master */}
      {editingGoal && (
        <EditGoalModal
          payload={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSaved={() => {
            setEditingGoal(null);
            qc.invalidateQueries();
          }}
        />
      )}
    </div>
  );
}

// ReactFragment helper wrapper for clean JSX in maps
function ReactFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------------------------ Detalhamento por Loja */

function StoreDetailCard({
  storeId,
  storeName,
  year,
  goalMap,
  actualMap,
  isMaster,
  onEditGoal,
}: {
  storeId: string;
  storeName: string;
  year: number;
  goalMap: Map<string, any>;
  actualMap: Map<string, any>;
  isMaster: boolean;
  onEditGoal: (payload: EditGoalPayload) => void;
}) {
  return (
    <Card className="border shadow-none bg-card">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <span>Detalhamento Oficial — {storeName} ({year})</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Meta Orçada (+10% sobre o ano anterior) vs Realizado Atual e Apuração de Elegibilidade
          </CardDescription>
        </div>
        {!isMaster && (
          <Badge variant="outline" className="text-xs bg-muted/40">
            🔒 Meta Fixa do Orçamento
          </Badge>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Faturamento A-1 ({year - 1})</TableHead>
                <TableHead className="text-right">Meta Orçada FAT (+10%)</TableHead>
                <TableHead className="text-right">FAT Realizado</TableHead>
                <TableHead className="text-right">% Atingimento FAT</TableHead>
                <TableHead className="text-center">Elegibilidade Bônus</TableHead>
                <TableHead className="text-right">TC A-1 ({year - 1})</TableHead>
                <TableHead className="text-right">Meta Orçada TC (+10%)</TableHead>
                <TableHead className="text-right">TC Realizado</TableHead>
                <TableHead className="text-right">% Atingimento TC</TableHead>
                {isMaster && <TableHead className="text-center">Ações Master</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PDF_MONTHS.map((pm) => {
                const goal = goalMap.get(`${storeId}-${pm.month}`);
                const actual = actualMap.get(`${storeId}-${pm.month}`);

                const baseFat = goal ? Number(goal.faturamento_base_ano_anterior) : 0;
                const metaFat = goal ? Number(goal.meta_faturamento) : 0;
                const revAct = actual?.revenue_actual != null ? Number(actual.revenue_actual) : null;
                const fatPct = metaFat > 0 && revAct !== null ? (revAct / metaFat) * 100 : null;

                const baseTc = goal ? Number(goal.tc_ano_anterior) : 0;
                const metaTc = goal ? Number(goal.meta_tc) : 0;
                const tcAct = actual?.tc_actual != null ? Number(actual.tc_actual) : null;
                const tcPct = metaTc > 0 && tcAct !== null ? (tcAct / metaTc) * 100 : null;

                const isEligible = fatPct !== null ? fatPct >= 90 : null;

                return (
                  <TableRow key={pm.month} className="text-xs">
                    <TableCell className="font-semibold">{pm.full}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{baseFat > 0 ? brl(baseFat) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{metaFat > 0 ? brl(metaFat) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{revAct !== null ? brl(revAct) : "—"}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-bold",
                        fatPct === null
                          ? "text-muted-foreground"
                          : fatPct >= 90
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive",
                      )}
                    >
                      {fatPct !== null ? `${fatPct.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEligible === true && (
                        <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5">
                          ELEGÍVEL
                        </Badge>
                      )}
                      {isEligible === false && (
                        <Badge variant="destructive" className="font-bold text-[10px] px-2 py-0.5">
                          INELEGÍVEL
                        </Badge>
                      )}
                      {isEligible === null && <span className="text-muted-foreground text-[11px]">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{baseTc > 0 ? intFmt(baseTc) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{metaTc > 0 ? intFmt(metaTc) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{tcAct !== null ? intFmt(tcAct) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">
                      {tcPct !== null ? `${tcPct.toFixed(1)}%` : "—"}
                    </TableCell>
                    {isMaster && (
                      <TableCell className="text-center">
                        {goal ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2 text-primary hover:text-primary"
                            onClick={() =>
                              onEditGoal({
                                goalId: goal.id,
                                storeName,
                                storeId,
                                year,
                                month: pm.month,
                                faturamentoBase: baseFat,
                                metaFaturamento: metaFat,
                                tcBase: baseTc,
                                metaTc,
                              })
                            }
                          >
                            <Edit3 className="size-3 mr-1" /> Editar
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Sem meta</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Modal de Edição de Meta (Exclusivo Master) */

function EditGoalModal({
  payload,
  onClose,
  onSaved,
}: {
  payload: EditGoalPayload;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updateStoreGoalManual);
  const [metaFat, setMetaFat] = useState(String(payload.metaFaturamento));
  const [metaTc, setMetaTc] = useState(String(payload.metaTc));
  const [reason, setReason] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () =>
      updateFn({
        data: {
          goal_id: payload.goalId,
          meta_faturamento: Number(metaFat),
          meta_tc: Number(metaTc),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Meta atualizada com sucesso!", {
        description: "A alteração e o motivo foram registrados na trilha de auditoria.",
      });
      onSaved();
    },
    onError: (e: Error) => toast.error("Erro ao atualizar meta", { description: e.message }),
  });

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Edit3 className="size-4 text-primary" />
            <span>Editar Meta Orçada — {payload.storeName}</span>
          </DialogTitle>
          <DialogDescription>
            Competência: <strong>{periodLabel(payload.month, payload.year)}</strong>. Exclusivo para o Master com registro obrigatório em auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Base FAT Ano Anterior:</span>
              <p className="font-semibold text-sm">{brl(payload.faturamentoBase)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Base TC Ano Anterior:</span>
              <p className="font-semibold text-sm">{intFmt(payload.tcBase)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-meta-fat">Nova Meta de Faturamento (R$)</Label>
              <Input
                id="edit-meta-fat"
                type="number"
                step="0.01"
                value={metaFat}
                onChange={(e) => setMetaFat(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-meta-tc">Nova Meta de TC (Clientes)</Label>
              <Input
                id="edit-meta-tc"
                type="number"
                step="1"
                value={metaTc}
                onChange={(e) => setMetaTc(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-reason" className="text-xs font-bold text-destructive">
              Motivo da Alteração (Obrigatório para Auditoria) *
            </Label>
            <Textarea
              id="edit-reason"
              rows={3}
              placeholder="Descreva a justificativa para o ajuste no orçamento oficial (ex: reforma, abertura antecipada, alinhamento diretoria)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!reason.trim() || reason.trim().length < 3 || updateMutation.isPending}
          >
            Salvar e Registrar em Auditoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------ Tabela Analítica Master */

function GoalsDashboard({ isMaster }: { isMaster?: boolean }) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [storeId, setStoreId] = useState("all");
  const [month, setMonth] = useState("all");
  const { data: stores } = useStores();

  const goals = useQuery({
    queryKey: ["store-goals", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_goals")
        .select(
          "id,store_id,year,month,base_year,faturamento_base_ano_anterior,meta_faturamento,tc_ano_anterior,meta_tc,growth_fat_pct,growth_tc_pct,version,stores(name)",
        )
        .eq("year", year)
        .order("month");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const history = useQuery({
    queryKey: ["revenue-history", year - 1],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_history")
        .select("store_id,month,receita_vendas,taxa_servico,faturamento_base_meta,tc")
        .eq("year", year - 1);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const historyMap = useMemo(() => {
    const m = new Map<string, { receita_vendas: number; taxa_servico: number }>();
    for (const h of history.data ?? []) m.set(`${h.store_id}-${h.month}`, h);
    return m;
  }, [history.data]);

  const rows = (goals.data ?? []).filter(
    (g) => (storeId === "all" || g.store_id === storeId) && (month === "all" || String(g.month) === month),
  );

  const totals = rows.reduce(
    (s, r) => ({
      base: s.base + Number(r.faturamento_base_ano_anterior),
      meta: s.meta + Number(r.meta_faturamento),
      tcBase: s.tcBase + Number(r.tc_ano_anterior),
      tcMeta: s.tcMeta + Number(r.meta_tc),
    }),
    { base: 0, meta: 0, tcBase: 0, tcMeta: 0 },
  );

  const growthFat = rows[0]?.growth_fat_pct ?? null;
  const growthTc = rows[0]?.growth_tc_pct ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label>Ano da meta</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[nowYear - 1, nowYear, nowYear + 1, nowYear + 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loja</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {(stores ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como a meta é formada</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <FlowStep label={`Receita de vendas ${year - 1}`} value={brl(totals.base - taxaTotal(rows, historyMap))} />
            <span className="text-muted-foreground">+</span>
            <FlowStep label="Taxa de serviço" value={brl(taxaTotal(rows, historyMap))} />
            <ArrowRight className="size-4 text-muted-foreground" />
            <FlowStep label="Faturamento base" value={brl(totals.base)} />
            <ArrowRight className="size-4 text-muted-foreground" />
            <FlowStep label={`+ ${growthFat ?? 10}%`} value={brl(totals.meta)} highlight />
            <span className="mx-2 h-8 w-px bg-border" />
            <FlowStep label={`TC ${year - 1}`} value={intFmt(totals.tcBase)} />
            <ArrowRight className="size-4 text-muted-foreground" />
            <FlowStep label={`+ ${growthTc ?? 10}%`} value={intFmt(totals.tcMeta)} highlight />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Metas Analíticas {year} — base {year - 1}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receita A-1</TableHead>
                  <TableHead className="text-right">Taxa serviço A-1</TableHead>
                  <TableHead className="text-right">Base A-1</TableHead>
                  <TableHead className="text-right">Meta faturamento</TableHead>
                  <TableHead className="text-right">TC A-1</TableHead>
                  <TableHead className="text-right">Meta TC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((g) => {
                  const h = historyMap.get(`${g.store_id}-${g.month}`);
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        {(g.stores as { name: string } | null)?.name ?? "—"}
                      </TableCell>
                      <TableCell>{MONTHS[g.month - 1]}</TableCell>
                      <TableCell className="text-right">{brl(h?.receita_vendas ?? null)}</TableCell>
                      <TableCell className="text-right">{brl(h?.taxa_servico ?? null)}</TableCell>
                      <TableCell className="text-right">{brl(g.faturamento_base_ano_anterior)}</TableCell>
                      <TableCell className="text-right font-semibold">{brl(g.meta_faturamento)}</TableCell>
                      <TableCell className="text-right">{intFmt(g.tc_ano_anterior)}</TableCell>
                      <TableCell className="text-right font-semibold">{intFmt(g.meta_tc)}</TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Nenhuma meta gerada para {year}. Sincronize o PDF na aba Orçamento de Metas.
                    </TableCell>
                  </TableRow>
                )}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={4}>Total {storeId === "all" ? "geral" : "da loja"}</TableCell>
                    <TableCell className="text-right">{brl(totals.base)}</TableCell>
                    <TableCell className="text-right">{brl(totals.meta)}</TableCell>
                    <TableCell className="text-right">{intFmt(totals.tcBase)}</TableCell>
                    <TableCell className="text-right">{intFmt(totals.tcMeta)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function taxaTotal(
  rows: Array<{ store_id: string; month: number }>,
  historyMap: Map<string, { taxa_servico: number }>,
) {
  return rows.reduce((s, r) => s + Number(historyMap.get(`${r.store_id}-${r.month}`)?.taxa_servico ?? 0), 0);
}

function FlowStep({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-md border border-primary/40 bg-primary/5 px-3 py-2" : "px-1"}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------- Growth settings */

function GrowthSettings() {
  const qc = useQueryClient();
  const read = useServerFn(getGoalGrowth);
  const save = useServerFn(saveGoalGrowth);
  const generate = useServerFn(generateGoals);
  const nowYear = new Date().getFullYear();
  const [baseYear, setBaseYear] = useState(nowYear - 1);
  const [form, setForm] = useState<{ fat_pct: string; tc_pct: string } | null>(null);

  const growth = useQuery({
    queryKey: ["goal-growth"],
    queryFn: async () => read(),
  });

  const values = form ?? {
    fat_pct: String(growth.data?.fat_pct ?? 10),
    tc_pct: String(growth.data?.tc_pct ?? 10),
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      save({ data: { fat_pct: Number(values.fat_pct), tc_pct: Number(values.tc_pct) } }),
    onSuccess: () => {
      toast.success("Percentual salvo. Gere as metas novamente para aplicá-lo.");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["goal-growth"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => generate({ data: { base_year: baseYear } }),
    onSuccess: (r) => {
      toast.success(`${r.count} meta(s) geradas para ${r.target_year}.`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Não foi possível gerar as metas", { description: e.message }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crescimento da meta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fat_pct">Crescimento do faturamento (%)</Label>
              <Input
                id="fat_pct"
                type="number"
                step="0.01"
                value={values.fat_pct}
                onChange={(e) => setForm({ ...values, fat_pct: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc_pct">Crescimento do TC (%)</Label>
              <Input
                id="tc_pct"
                type="number"
                step="0.01"
                value={values.tc_pct}
                onChange={(e) => setForm({ ...values, tc_pct: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta = base do ano anterior × (1 + crescimento). Alterar o percentual não muda metas já geradas —
            use "Gerar metas" para recalcular.
          </p>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Salvar percentual
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gerar metas novamente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ano base (histórico importado)</Label>
            <Select value={String(baseYear)} onValueChange={(v) => setBaseYear(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[nowYear - 2, nowYear - 1, nowYear].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Recalcula mês a mês as metas de {baseYear + 1} a partir do histórico de {baseYear}, preservando a
            sazonalidade. Cada geração cria uma nova versão registrada.
          </p>
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <RefreshCw className="size-4" /> Gerar metas de {baseYear + 1}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------- Import wizard */

type Step = "upload" | "map" | "review";

function ImportWizard() {
  const qc = useQueryClient();
  const nowYear = new Date().getFullYear();
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importRevenueHistory);
  const { data: stores } = useStores();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [workbook, setWorkbook] = useState<unknown>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Array<Record<string, unknown>>>([]);
  const [map, setMap] = useState<ColumnMap>({ store: "", month: "", receita: "", taxa: "", tc: "" });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [baseYear, setBaseYear] = useState(nowYear - 1);
  const [confirmConflicts, setConfirmConflicts] = useState<Array<{ store_id: string; month: number }> | null>(
    null,
  );

  async function loadSheet(wb: unknown, name: string) {
    const XLSX = await import("xlsx");
    const sheetObj = (wb as { Sheets: Record<string, unknown> }).Sheets[name];
    const json = XLSX.utils.sheet_to_json(sheetObj as never, { defval: "", raw: true }) as Array<
      Record<string, unknown>
    >;
    const cols = json.length > 0 ? Object.keys(json[0]!) : [];
    setHeaders(cols);
    setRaw(json);
    setMap({
      store: guessColumn(cols, COLUMN_HINTS.store),
      month: guessColumn(cols, COLUMN_HINTS.month),
      receita: guessColumn(cols, COLUMN_HINTS.receita),
      taxa: guessColumn(cols, COLUMN_HINTS.taxa),
      tc: guessColumn(cols, COLUMN_HINTS.tc),
    });
    setStep("map");
  }

  async function onFile(file: File) {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      setWorkbook(wb);
      setFileName(file.name);
      setSheets(wb.SheetNames);
      setSheet(wb.SheetNames[0]!);
      await loadSheet(wb, wb.SheetNames[0]!);
    } catch (e) {
      toast.error("Não foi possível ler a planilha", { description: (e as Error).message });
    }
  }

  const rows: ParsedRow[] = useMemo(
    () => (map.store && map.month ? buildRows(raw, map, stores ?? [], overrides) : []),
    [raw, map, stores, overrides],
  );
  const dups = useMemo(() => duplicateKeys(rows), [rows]);
  const invalid = rows.filter((r) => r.errors.length > 0);
  const unmatched = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) if (r.storeName && !r.storeId) set.set(normalize(r.storeName), r.storeName);
    return [...set.entries()];
  }, [rows]);
  const valid = rows.filter((r) => r.errors.length === 0 && !dups.has(`${r.storeId}-${r.month}`));

  const doImport = useMutation({
    mutationFn: async (replace: boolean) =>
      importFn({
        data: {
          base_year: baseYear,
          replace,
          source_file: fileName || null,
          rows: valid.map((r) => ({
            store_id: r.storeId!,
            month: r.month!,
            receita_vendas: Number(r.receita ?? 0),
            taxa_servico: Number(r.taxa ?? 0),
            tc: Number(r.tc ?? 0),
          })),
        },
      }),
    onSuccess: (res) => {
      if (res.needsConfirmation) {
        setConfirmConflicts(res.conflicts);
        return;
      }
      setConfirmConflicts(null);
      toast.success(`Importação concluída: ${res.imported} linha(s), ${res.goals} meta(s) geradas.`);
      setStep("upload");
      setRaw([]);
      setHeaders([]);
      setFileName("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Importação bloqueada", { description: e.message }),
  });

  const storeName = (id: string) => (stores ?? []).find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Selecionar a planilha do ano anterior</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Ano base da planilha</Label>
            <Select value={String(baseYear)} onValueChange={(v) => setBaseYear(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[nowYear - 2, nowYear - 1, nowYear].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Importar Excel
          </Button>
          {fileName && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" /> {fileName} · {raw.length} linha(s)
            </span>
          )}
          {sheets.length > 1 && (
            <div className="space-y-1.5">
              <Label>Aba</Label>
              <Select
                value={sheet}
                onValueChange={(v) => {
                  setSheet(v);
                  if (workbook) void loadSheet(workbook, v);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {step !== "upload" && headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Mapear as colunas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {(
              [
                ["store", "Loja (Coluna D)"],
                ["month", "Mês (Coluna F)"],
                ["receita", "FATURAMENTO (Coluna H)"],
                ["taxa", "Taxa de serviço (opcional)"],
                ["tc", "TC — Clientes/Pedidos (Coluna L)"],
              ] as Array<[keyof ColumnMap, string]>
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Select
                  value={map[key] || "none"}
                  onValueChange={(v) => setMap((m) => ({ ...m, [key]: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— não usar —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vincular lojas não reconhecidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {unmatched.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Select
                  value={overrides[key] ?? ""}
                  onValueChange={(v) => setOverrides((o) => ({ ...o, [key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a loja cadastrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {(stores ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          {invalid.length > 0 || dups.size > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Verifique antes de confirmar</AlertTitle>
              <AlertDescription>
                {invalid.length > 0 && <p>{invalid.length} linha(s) com problema serão ignoradas.</p>}
                {dups.size > 0 && <p>{dups.size} combinação(ões) de loja + mês duplicadas na planilha.</p>}
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {invalid.slice(0, 8).map((r) => (
                    <li key={r.index}>
                      Linha {r.index} ({r.storeName || "sem loja"}): {r.errors.join(", ")}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>Planilha validada</AlertTitle>
              <AlertDescription>
                {valid.length} linha(s) prontas para importar como ano base {baseYear}.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">3. Pré-visualização</CardTitle>
              <Button
                onClick={() => doImport.mutate(false)}
                disabled={valid.length === 0 || doImport.isPending}
              >
                Confirmar importação
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Receita de vendas</TableHead>
                      <TableHead className="text-right">Taxa de serviço</TableHead>
                      <TableHead className="text-right">Faturamento base</TableHead>
                      <TableHead className="text-right">TC</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 400).map((r) => {
                      const bad = r.errors.length > 0 || dups.has(`${r.storeId}-${r.month}`);
                      return (
                        <TableRow key={r.index} className={bad ? "bg-destructive/5" : undefined}>
                          <TableCell className="font-medium">
                            {r.storeId ? storeName(r.storeId) : r.storeName || "—"}
                          </TableCell>
                          <TableCell>{r.month ? MONTHS[r.month - 1] : "—"}</TableCell>
                          <TableCell className="text-right">{brl(r.receita)}</TableCell>
                          <TableCell className="text-right">{brl(r.taxa)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {brl(Number(r.receita ?? 0) + Number(r.taxa ?? 0))}
                          </TableCell>
                          <TableCell className="text-right">{intFmt(r.tc)}</TableCell>
                          <TableCell className="text-right">
                            {bad ? (
                              <Badge variant="outline" className="border-destructive/40 text-destructive">
                                Ignorada
                              </Badge>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!confirmConflicts} onOpenChange={(o) => !o && setConfirmConflicts(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe uma informação para este período.</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConflicts?.length} registro(s) de {baseYear} já estão gravados:{" "}
              {(confirmConflicts ?? [])
                .slice(0, 6)
                .map((c) => `${storeName(c.store_id)} — ${MONTHS[c.month - 1]}`)
                .join(", ")}
              {(confirmConflicts?.length ?? 0) > 6 ? "…" : ""}. Substituir mantém o histórico registrado na
              auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => doImport.mutate(true)}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
