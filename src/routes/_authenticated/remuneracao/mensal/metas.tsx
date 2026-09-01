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
  deduplicateStores,
  generateGoals,
  getGoalGrowth,
  importActualRevenue,
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
  const dedupStoresFn = useServerFn(deduplicateStores);
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

  const dedupMutation = useMutation({
    mutationFn: async () => dedupStoresFn({}),
    onSuccess: (res) => {
      toast.success("Lojas padronizadas com sucesso!", {
        description: `${res.storesUpdated} lojas oficiais ajustadas e ${res.duplicatesRemoved} duplicidades removidas.`,
      });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Falha ao padronizar lojas", { description: e.message }),
  });

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
    type GoalRow = NonNullable<typeof goalsQuery.data>[number];
    const m = new Map<string, GoalRow>();
    for (const g of goalsQuery.data ?? []) {
      m.set(`${g.store_id}-${g.month}`, g);
    }
    return m;
  }, [goalsQuery.data]);

  // Lista de lojas ativas com deduplicação e padrão uniforme
  const activeStores = useMemo(() => {
    const list = (stores ?? []).filter((s) => s.active);
    const seen = new Set<string>();
    const unique: typeof list = [];
    for (const s of list) {
      const key = (s.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/^sp\s+|^es\s+/, "")
        .trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    return unique.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border text-xs"
                onClick={() => dedupMutation.mutate()}
                disabled={dedupMutation.isPending}
              >
                <RefreshCw className={cn("size-3.5 mr-1.5", dedupMutation.isPending && "animate-spin")} />
                {dedupMutation.isPending ? "Padronizando..." : "Padronizar Lojas"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold"
                onClick={() => syncPdfMutation.mutate()}
                disabled={syncPdfMutation.isPending}
              >
                <Sparkles className="size-3.5 text-primary mr-1.5" />
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

      {/* Tabela Gerencial de Metas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span>
                Painel de Metas {year} — {metric === "faturamento" ? "Faturamento (R$)" : "TC (Clientes)"}
              </span>
            </CardTitle>
            <CardDescription>
              ORÇADO = Meta oficial · REALIZADO = Faturamento apurado · GAP = Realizado − Orçado · Clique na loja para detalhes mensais
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50 font-bold text-xs uppercase tracking-wide">
                  <TableHead className="w-[200px]">LOJA</TableHead>
                  <TableHead className="text-right text-primary">ORÇADO</TableHead>
                  <TableHead className="text-right">REALIZADO</TableHead>
                  <TableHead className="text-right">GAP</TableHead>
                  <TableHead className="text-center">STATUS</TableHead>
                  <TableHead className="text-center w-[90px] text-muted-foreground font-normal normal-case text-xs">Detalhar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStores && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Carregando orçamento...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingStores && activeStores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhuma loja ativa cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {activeStores.map((s) => {
                  const isExpanded = expandedStoreId === s.id;

                  // Calcula totais da loja no período
                  let storeOrcado = 0;
                  let storeRealizado = 0;
                  let storeHasRealizado = false;
                  for (const pm of PDF_MONTHS) {
                    const goal = goalMap.get(`${s.id}-${pm.month}`);
                    const actual = actualMap.get(`${s.id}-${pm.month}`);
                    storeOrcado += goal
                      ? metric === "faturamento" ? Number(goal.meta_faturamento) : Number(goal.meta_tc)
                      : 0;
                    const rev = metric === "faturamento"
                      ? actual?.revenue_actual
                      : actual?.tc_actual;
                    if (rev != null) { storeRealizado += Number(rev); storeHasRealizado = true; }
                  }
                  const storeGap = storeHasRealizado && storeOrcado > 0 ? storeRealizado - storeOrcado : null;
                  const storeBateu = storeHasRealizado && storeOrcado > 0 ? storeRealizado >= storeOrcado : null;

                  return (
                    <ReactFragment key={s.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/30 transition-colors",
                          isExpanded && "bg-muted/20 border-l-4 border-l-primary",
                          storeBateu === true && !isExpanded && "bg-emerald-50/30 dark:bg-emerald-950/10",
                          storeBateu === false && !isExpanded && "bg-red-50/30 dark:bg-red-950/10",
                        )}
                        onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                      >
                        {/* LOJA */}
                        <TableCell className="font-semibold flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-primary shrink-0" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{s.name}</span>
                        </TableCell>

                        {/* ORÇADO */}
                        <TableCell className="text-right font-bold text-primary">
                          {storeOrcado > 0
                            ? metric === "faturamento" ? brl(storeOrcado) : intFmt(storeOrcado)
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* REALIZADO */}
                        <TableCell className="text-right font-semibold">
                          {storeHasRealizado ? (
                            <span className={cn(
                              storeBateu === true && "text-emerald-700 dark:text-emerald-400",
                              storeBateu === false && "text-red-700 dark:text-red-400",
                            )}>
                              {metric === "faturamento" ? brl(storeRealizado) : intFmt(storeRealizado)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Não lançado</span>
                          )}
                        </TableCell>

                        {/* GAP */}
                        <TableCell className="text-right font-bold">
                          {storeGap !== null ? (
                            <span className={storeGap >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-700 dark:text-red-400"}>
                              {storeGap >= 0 ? "+" : ""}
                              {metric === "faturamento" ? brl(storeGap) : intFmt(storeGap)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* STATUS */}
                        <TableCell className="text-center">
                          {storeBateu === null ? (
                            <span className="text-muted-foreground text-xs">Aguardando</span>
                          ) : storeBateu ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 shadow-sm">
                              🟢 META BATIDA
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="font-bold text-[10px] px-2 py-0.5">
                              🔴 NÃO BATIDA
                            </Badge>
                          )}
                        </TableCell>

                        {/* DETALHAR */}
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                          >
                            {isExpanded ? "Ocultar" : "Ver meses"}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Detalhamento mês a mês */}
                      {isExpanded && (
                        <TableRow className="bg-muted/10">
                          <TableCell colSpan={6} className="p-4">
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
                {activeStores.length > 0 && (() => {
                  let grandOrcado = 0;
                  let grandRealizado = 0;
                  let grandHasRealizado = false;
                  for (const pm of PDF_MONTHS) {
                    const mTot = monthlyTotals[pm.month];
                    grandOrcado += metric === "faturamento" ? mTot?.metaFat ?? 0 : mTot?.metaTc ?? 0;
                  }
                  for (const p of actualsQuery.data ?? []) {
                    const t = p.store_targets as unknown as { revenue_actual: number | null; tc_actual: number | null } | null;
                    const val = metric === "faturamento" ? t?.revenue_actual : t?.tc_actual;
                    if (val != null) { grandRealizado += Number(val); grandHasRealizado = true; }
                  }
                  const grandGap = grandHasRealizado && grandOrcado > 0 ? grandRealizado - grandOrcado : null;
                  const grandBateu = grandHasRealizado && grandOrcado > 0 ? grandRealizado >= grandOrcado : null;
                  return (
                    <TableRow className="bg-muted/60 font-extrabold border-t-2 text-sm">
                      <TableCell className="font-extrabold uppercase tracking-wide text-xs">TOTAL CONSOLIDADO</TableCell>
                      <TableCell className="text-right font-extrabold text-primary">
                        {grandOrcado > 0 ? (metric === "faturamento" ? brl(grandOrcado) : intFmt(grandOrcado)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-extrabold">
                        {grandHasRealizado ? (
                          <span className={cn(
                            grandBateu === true && "text-emerald-700 dark:text-emerald-400",
                            grandBateu === false && "text-red-700 dark:text-red-400",
                          )}>
                            {metric === "faturamento" ? brl(grandRealizado) : intFmt(grandRealizado)}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-extrabold">
                        {grandGap !== null ? (
                          <span className={grandGap >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                            {grandGap >= 0 ? "+" : ""}{metric === "faturamento" ? brl(grandGap) : intFmt(grandGap)}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {grandBateu === null ? (
                          <span className="text-muted-foreground text-xs">Aguardando</span>
                        ) : grandBateu ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1 shadow">
                            🟢 META BATIDA
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="font-extrabold text-[11px] px-3 py-1">
                            🔴 NÃO BATIDA
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })()}
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
  // Acumula totais anuais
  let totalOrcado = 0;
  let totalRealizado = 0;
  let hasRealizado = false;

  const rows = PDF_MONTHS.map((pm) => {
    const goal = goalMap.get(`${storeId}-${pm.month}`);
    const actual = actualMap.get(`${storeId}-${pm.month}`);

    const orcado = goal ? Number(goal.meta_faturamento) : 0;
    const realizado = actual?.revenue_actual != null ? Number(actual.revenue_actual) : null;
    const gap = realizado !== null && orcado > 0 ? realizado - orcado : null;
    const pct = orcado > 0 && realizado !== null ? (realizado / orcado) * 100 : null;
    const bateu = realizado !== null && orcado > 0 ? realizado >= orcado : null;

    totalOrcado += orcado;
    if (realizado !== null) { totalRealizado += realizado; hasRealizado = true; }

    return { pm, goal, orcado, realizado, gap, pct, bateu };
  });

  const totalGap = hasRealizado ? totalRealizado - totalOrcado : null;
  const totalBateu = hasRealizado && totalOrcado > 0 ? totalRealizado >= totalOrcado : null;

  return (
    <Card className="border shadow-none bg-card">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <span>{storeName} — Acompanhamento de Metas {year}</span>
          </CardTitle>
          <CardDescription className="text-xs">
            ORÇADO = Meta oficial ({year}) · REALIZADO = Faturamento apurado · GAP = Realizado − Orçado
          </CardDescription>
        </div>
        {!isMaster && (
          <Badge variant="outline" className="text-xs bg-muted/40">
            🔒 Meta Fixa
          </Badge>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs font-bold sticky top-0 z-10">
                <TableHead className="text-center font-bold">PERÍODO</TableHead>
                <TableHead className="text-right font-bold text-primary">ORÇADO</TableHead>
                <TableHead className="text-right font-bold">REALIZADO</TableHead>
                <TableHead className="text-right font-bold">GAP</TableHead>
                <TableHead className="text-center font-bold">STATUS</TableHead>
                {isMaster && <TableHead className="text-center text-muted-foreground font-normal text-[10px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ pm, goal, orcado, realizado, gap, pct, bateu }) => (
                <TableRow
                  key={pm.month}
                  className={cn(
                    "text-xs hover:bg-muted/20 transition-colors",
                    bateu === true && "bg-emerald-50/30 dark:bg-emerald-950/10",
                    bateu === false && "bg-red-50/30 dark:bg-red-950/10",
                  )}
                >
                  {/* PERÍODO */}
                  <TableCell className="text-center font-semibold text-xs">
                    {pm.full}
                  </TableCell>

                  {/* ORÇADO */}
                  <TableCell className="text-right font-bold text-primary text-xs">
                    {orcado > 0 ? brl(orcado) : <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  {/* REALIZADO */}
                  <TableCell className="text-right font-semibold text-xs">
                    {realizado !== null ? (
                      <span className={cn(
                        bateu === true && "text-emerald-700 dark:text-emerald-400",
                        bateu === false && "text-red-700 dark:text-red-400",
                      )}>
                        {brl(realizado)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Não lançado</span>
                    )}
                  </TableCell>

                  {/* GAP */}
                  <TableCell className="text-right font-bold text-xs">
                    {gap !== null ? (
                      <span className={cn(
                        gap >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                      )}>
                        {gap >= 0 ? "+" : ""}{brl(gap)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* STATUS */}
                  <TableCell className="text-center whitespace-nowrap">
                    {bateu === null ? (
                      <span className="text-muted-foreground text-[10px]">Aguardando</span>
                    ) : bateu ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 shadow-sm">
                        🟢 META BATIDA
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="font-bold text-[10px] px-2 py-0.5">
                        🔴 NÃO BATIDA
                      </Badge>
                    )}
                    {pct !== null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(1)}%</p>
                    )}
                  </TableCell>

                  {/* AÇÕES MASTER */}
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
                              faturamentoBase: goal ? Number(goal.faturamento_base_ano_anterior) : 0,
                              metaFaturamento: goal ? Number(goal.meta_faturamento) : 0,
                              tcBase: goal ? Number(goal.tc_ano_anterior) : 0,
                              metaTc: goal ? Number(goal.meta_tc) : 0,
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
              ))}

              {/* TOTAL ANUAL */}
              <TableRow className={cn(
                "font-extrabold border-t-2 text-sm",
                totalBateu === true && "bg-emerald-100/60 dark:bg-emerald-900/20",
                totalBateu === false && "bg-red-100/40 dark:bg-red-900/10",
                totalBateu === null && "bg-muted/40",
              )}>
                <TableCell className="text-center font-extrabold text-xs uppercase tracking-wide">
                  TOTAL ANUAL
                </TableCell>
                <TableCell className="text-right font-extrabold text-primary text-xs">
                  {totalOrcado > 0 ? brl(totalOrcado) : "—"}
                </TableCell>
                <TableCell className="text-right font-extrabold text-xs">
                  {hasRealizado ? (
                    <span className={cn(
                      totalBateu === true && "text-emerald-700 dark:text-emerald-400",
                      totalBateu === false && "text-red-700 dark:text-red-400",
                    )}>
                      {brl(totalRealizado)}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right font-extrabold text-xs">
                  {totalGap !== null ? (
                    <span className={totalGap >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                      {totalGap >= 0 ? "+" : ""}{brl(totalGap)}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {totalBateu === null ? (
                    <span className="text-muted-foreground text-xs">Aguardando</span>
                  ) : totalBateu ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1 shadow">
                      🟢 META BATIDA
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="font-extrabold text-[11px] px-3 py-1">
                      🔴 NÃO BATIDA
                    </Badge>
                  )}
                </TableCell>
                {isMaster && <TableCell />}
              </TableRow>
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
          {/* Fluxo visual: META IMPORTADA → GERENTE ALTERA */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs space-y-2">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-[11px] uppercase tracking-wide">
              Fluxo de Meta — {payload.storeName}
            </p>
            <div className="grid gap-2 sm:grid-cols-4 items-center text-center">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Base FAT {payload.year - 1}</p>
                <p className="font-semibold text-sm">{brl(payload.faturamentoBase)}</p>
              </div>
              <div className="text-muted-foreground text-lg font-light">→</div>
              <div className="space-y-0.5 col-span-2 rounded border border-primary/30 bg-primary/5 px-2 py-1">
                <p className="text-muted-foreground">Meta Gerada (+10%) — valor importado</p>
                <p className="font-bold text-sm text-primary">{brl(payload.metaFaturamento)}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4 items-center text-center">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Base TC {payload.year - 1}</p>
                <p className="font-semibold text-sm">{intFmt(payload.tcBase)}</p>
              </div>
              <div className="text-muted-foreground text-lg font-light">→</div>
              <div className="space-y-0.5 col-span-2 rounded border border-primary/30 bg-primary/5 px-2 py-1">
                <p className="text-muted-foreground">Meta TC Gerada (+10%) — valor importado</p>
                <p className="font-bold text-sm text-primary">{intFmt(payload.metaTc)}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              ⚠️ O faturamento <strong>realizado</strong> importado não é alterado por esta edição.
              Apenas a <strong>meta orçada</strong> será atualizada.
            </p>
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
  const importActualFn = useServerFn(importActualRevenue);
  const { data: stores } = useStores();

  const [importMode, setImportMode] = useState<"meta" | "realizado">("meta");
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [workbook, setWorkbook] = useState<unknown>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Array<Record<string, unknown>>>([]);
  const [map, setMap] = useState<ColumnMap>({ store: "", month: "", receita: "", taxa: "", tc: "" });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [baseYear, setBaseYear] = useState(importMode === "meta" ? nowYear - 1 : nowYear);
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
    mutationFn: async (replace: boolean) => {
      if (importMode === "meta") {
        return importFn({
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
        });
      } else {
        const res = await importActualFn({
          data: {
            year: baseYear,
            source_file: fileName || null,
            rows: valid.map((r) => ({
              store_id: r.storeId!,
              month: r.month!,
              revenue_actual: Number(r.receita ?? 0) + Number(r.taxa ?? 0),
              tc_actual: Number(r.tc ?? 0),
            })),
          },
        });
        return {
          ok: true as const,
          needsConfirmation: false as const,
          conflicts: [],
          imported: res.count,
          goals: 0,
        };
      }
    },
    onSuccess: (res) => {
      if (res.needsConfirmation) {
        setConfirmConflicts(res.conflicts);
        return;
      }
      setConfirmConflicts(null);
      if (importMode === "meta") {
        toast.success(`Importação para metas concluída: ${res.imported} linha(s) e ${res.goals} meta(s) geradas (+10%).`);
      } else {
        toast.success(`Importação do realizado concluída: ${res.imported} registro(s) atualizados.`);
      }
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
      {/* Seletor de Tipo de Importação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Importação</CardTitle>
          <CardDescription>
            Escolha se deseja importar o histórico para cálculo da meta ou o faturamento realizado do ano atual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              onClick={() => {
                setImportMode("meta");
                setBaseYear(nowYear - 1);
              }}
              className={cn(
                "cursor-pointer rounded-lg border-2 p-4 transition-all hover:bg-muted/30",
                importMode === "meta"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border text-muted-foreground",
              )}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <FileSpreadsheet className={cn("size-4", importMode === "meta" && "text-primary")} />
                <span>IMPORTAR DADOS PARA META</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Dados históricos do ano anterior ({nowYear - 1}) utilizados para calcular automaticamente a meta de {nowYear} (+10%).
              </p>
            </div>

            <div
              onClick={() => {
                setImportMode("realizado");
                setBaseYear(nowYear);
              }}
              className={cn(
                "cursor-pointer rounded-lg border-2 p-4 transition-all hover:bg-muted/30",
                importMode === "realizado"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border text-muted-foreground",
              )}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Upload className={cn("size-4", importMode === "realizado" && "text-primary")} />
                <span>IMPORTAR FATURAMENTO REALIZADO</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Dados realizados do ano atual ({nowYear}) para confronto direto com a meta orçada e apuração de atingimento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção do Arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            1. Selecionar a planilha {importMode === "meta" ? "do ano anterior" : "do ano atual"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>{importMode === "meta" ? "Ano base (histórico anterior)" : "Ano de referência (realizado)"}</Label>
            <Select value={String(baseYear)} onValueChange={(v) => setBaseYear(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[nowYear - 2, nowYear - 1, nowYear, nowYear + 1].map((y) => (
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
            <Upload className="size-4 mr-1.5" /> Importar Excel
          </Button>
          {fileName && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4 text-primary" /> {fileName} · {raw.length} linha(s)
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
                {valid.length} linha(s) prontas para importar como {importMode === "meta" ? `ano base ${baseYear} (Meta ${baseYear + 1})` : `realizado de ${baseYear}`}.
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
                {importMode === "meta" ? "Confirmar Dados para Meta (+10%)" : "Confirmar Faturamento Realizado"}
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
                      <TableHead className="text-right">Faturamento total</TableHead>
                      <TableHead className="text-right">TC (Pedidos)</TableHead>
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
              {(confirmConflicts?.length ?? 0) > 6 ? "…" : ""}. Ao substituir, os dados existentes serão atualizados sem gerar duplicidades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => doImport.mutate(true)}>Atualizar Registros</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
