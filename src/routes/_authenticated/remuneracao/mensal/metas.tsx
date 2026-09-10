import React, { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  Edit3,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  
  History,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  TrendingUp,
  Upload,
  Users,
  X,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { brl, MONTHS, periodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deduplicateStores,
  getGoalGrowth,
  saveGoalGrowth,
  
  updateStoreGoalManual,
  generateGoals,
  importRevenueHistory,
} from "@/lib/goals.functions";
import { readMetasConsultivo } from "@/lib/metas-read.functions";
import { parseWorkbookAuto, normalize, type AutoImportedRow, type AutoImportResult } from "@/lib/goal-import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/remuneracao/mensal/metas")({
  head: () => ({
    meta: [
      { title: "Orçamento de Metas | PRISMA" },
      {
        name: "description",
        content: "Orçamento oficial de metas mensais por loja e consolidação de faturamento realizado.",
      },
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

export function getAtingimentoStatus(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) {
    return {
      label: "Não lançado",
      shortLabel: "Não lançado",
      icon: "⚪",
      color: "text-muted-foreground",
      badgeClass: "bg-muted text-muted-foreground border-border",
      barColor: "bg-muted",
      code: "none" as const,
    };
  }

  if (pct >= 100) {
    return {
      label: "META SUPERADA",
      shortLabel: "SUPERADA",
      icon: "🟢",
      color: "text-emerald-700 dark:text-emerald-400",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700",
      barColor: "bg-emerald-500",
      code: "superada" as const,
    };
  }

  if (pct >= 90) {
    return {
      label: "ATINGIDO",
      shortLabel: "ATINGIDO",
      icon: "🟢",
      color: "text-emerald-700 dark:text-emerald-400",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700",
      barColor: "bg-emerald-500",
      code: "atingido" as const,
    };
  }

  if (pct >= 85) {
    return {
      label: "QUASE",
      shortLabel: "QUASE",
      icon: "🟡",
      color: "text-amber-700 dark:text-amber-400",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700",
      barColor: "bg-amber-500",
      code: "quase" as const,
    };
  }

  if (pct >= 80) {
    return {
      label: "ABAIXO",
      shortLabel: "ABAIXO",
      icon: "🔴",
      color: "text-orange-700 dark:text-orange-400",
      badgeClass: "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700",
      barColor: "bg-orange-500",
      code: "abaixo" as const,
    };
  }

  return {
    label: "CRÍTICO",
    shortLabel: "CRÍTICO",
    icon: "🔴",
    color: "text-rose-700 dark:text-rose-400",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700",
    barColor: "bg-rose-600",
    code: "critico" as const,
  };
}

function AtingimentoIndicator({ pct, compact = false }: { pct: number | null; compact?: boolean }) {
  if (pct === null || !Number.isFinite(pct)) {
    return <span className="text-muted-foreground text-xs italic">Não lançado</span>;
  }

  const status = getAtingimentoStatus(pct);

  if (compact) {
    return (
      <span className={cn("font-bold text-xs", status.color)}>
        {pct.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span className={cn("font-bold text-xs tabular-nums", status.color)}>
        {pct.toFixed(1)}%
      </span>
      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
        <div
          className={cn("h-full rounded-full transition-all duration-300", status.barColor)}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function AtingimentoStatusBadge({ pct }: { pct: number | null }) {
  const status = getAtingimentoStatus(pct);
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap", status.badgeClass)}
    >
      <span className="mr-1">{status.icon}</span>
      <span>{status.shortLabel}</span>
    </Badge>
  );
}

export function copyWhatsAppMessage(params: {
  storeName: string;
  meta: number;
  realizado: number | null;
  tc: number | null;
  pct: number | null;
  gap?: number | null;
  monthLabel?: string;
}) {
  const status = getAtingimentoStatus(params.pct);
  const metaStr = brl(params.meta);
  const realStr = params.realizado !== null ? brl(params.realizado) : "Não lançado";
  const tcStr = params.tc !== null && params.tc > 0 ? intFmt(params.tc) : "—";
  const pctStr = params.pct !== null ? `${params.pct.toFixed(1)}%` : "—";
  const gapVal = params.gap ?? (params.realizado !== null && params.meta > 0 ? params.realizado - params.meta : null);
  const gapStr = gapVal !== null ? `${gapVal >= 0 ? "+" : ""}${brl(gapVal)}` : "—";

  const message = [
    `📊 *META — ${params.storeName.toUpperCase()}*${params.monthLabel ? ` (${params.monthLabel})` : ""}`,
    ``,
    `🎯 *Meta:* ${metaStr}`,
    `💰 *Realizado:* ${realStr}`,
    `📈 *Atingimento:* ${pctStr}`,
    `📊 *Variação:* ${gapStr}`,
    `🧾 *Atendimentos:* ${tcStr}`,
    `${status.icon} *Status:* ${status.label}`,
  ].join("\n");

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(message).then(() => {
      toast.success(`Metas de ${params.storeName} copiadas!`, {
        description: "Mensagem formatada para WhatsApp copiada para a área de transferência.",
      });
    }).catch(() => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
    });
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
  }
}

/* ------------------------------------------------------------------ Hook Unificado de Faturamento Realizado */

/**
 * Leitura consultiva do módulo (metas + realizado de todas as lojas).
 * Somente leitura, disponível para Master, Treinador e Gerente.
 */
function useConsultSnapshot(year: number) {
  const read = useServerFn(readMetasConsultivo);
  return useQuery({
    queryKey: ["metas-consultivo", year],
    queryFn: () => read({ data: { year: Number(year) } }),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}

export function useActuals(year: number) {
  const snapshot = useConsultSnapshot(year);
  return { ...snapshot, data: snapshot.data?.actuals };
}

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
  const [tab, setTab] = useState("orcamento");
  const [wizardMode, setWizardMode] = useState<"realizado" | "meta">("realizado");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="orcamento">Orçamento de Metas (Matriz)</TabsTrigger>
        <TabsTrigger value="importar">Importar Planilha</TabsTrigger>
        <TabsTrigger value="config">Parâmetros de Crescimento</TabsTrigger>
      </TabsList>
      <TabsContent value="orcamento">
        <BudgetMatrixView
          isMaster={true}
          onImportActuals={() => {
            setWizardMode("realizado");
            setTab("importar");
          }}
        />
      </TabsContent>
      <TabsContent value="importar">
        <ImportWizard key={wizardMode} initialMode={wizardMode} />
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

function BudgetMatrixView({ isMaster, onImportActuals }: { isMaster: boolean; onImportActuals?: () => void }) {
  const qc = useQueryClient();
  
  const dedupStoresFn = useServerFn(deduplicateStores);
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(2026);
  const [metric, setMetric] = useState<"faturamento" | "tc">("faturamento");
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<EditGoalPayload | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = Ano completo

  const displayMonths = useMemo(() => {
    if (selectedMonth === 0) return PDF_MONTHS;
    const name = MONTHS[selectedMonth - 1] ?? "";
    return [{ month: selectedMonth, label: name.slice(0, 3).toUpperCase(), full: name }];
  }, [selectedMonth]);

  const periodLabelText = selectedMonth === 0
    ? `Jun–Dez/${year}`
    : `${MONTHS[selectedMonth - 1]}/${year}`;

  const { data: stores } = useStores();

  // Leitura consultiva (todas as lojas) — mesma fonte para metas e realizado
  const snapshot = useConsultSnapshot(year);
  const goalsQuery = { ...snapshot, data: snapshot.data?.goals };
  const actualsQuery = useActuals(year);

  const actualMap = useMemo(() => {
    const m = new Map<string, { revenue_actual: number | null; tc_actual: number | null }>();
    for (const item of actualsQuery.data ?? []) {
      m.set(`${item.store_id}-${item.month}`, {
        revenue_actual: item.revenue_actual,
        tc_actual: item.tc_actual,
      });
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
    for (let m = 1; m <= 12; m++) {
      totals[m] = { baseFat: 0, metaFat: 0, baseTc: 0, metaTc: 0 };
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
    const result = { metaFat: 0, baseFat: 0, metaTc: 0, baseTc: 0 };
    for (const dm of displayMonths) {
      const t = monthlyTotals[dm.month];
      if (t) {
        result.baseFat += t.baseFat;
        result.metaFat += t.metaFat;
        result.baseTc += t.baseTc;
        result.metaTc += t.metaTc;
      }
    }
    return result;
  }, [monthlyTotals, displayMonths]);

  // Totais Consolidados Gerais
  const grandTotals = useMemo(() => {
    let grandOrcado = 0;
    let grandRealizado = 0;
    let grandTc = 0;
    let grandHasRealizado = false;

    for (const pm of displayMonths) {
      const mTot = monthlyTotals[pm.month];
      grandOrcado += metric === "faturamento" ? mTot?.metaFat ?? 0 : mTot?.metaTc ?? 0;
    }

    for (const s of activeStores) {
      for (const pm of displayMonths) {
        const actual = actualMap.get(`${s.id}-${pm.month}`);
        const val = metric === "faturamento" ? actual?.revenue_actual : actual?.tc_actual;
        if (val != null) {
          grandRealizado += Number(val);
          grandHasRealizado = true;
        }
        if (actual?.tc_actual != null) {
          grandTc += Number(actual.tc_actual);
        }
      }
    }

    const grandGap = grandHasRealizado && grandOrcado > 0 ? grandRealizado - grandOrcado : null;
    const grandPct = grandHasRealizado && grandOrcado > 0 ? (grandRealizado / grandOrcado) * 100 : null;
    const grandStatus = getAtingimentoStatus(grandPct);

    return {
      grandOrcado,
      grandRealizado,
      grandTc,
      grandHasRealizado,
      grandGap,
      grandPct,
      grandStatus,
    };
  }, [monthlyTotals, activeStores, actualMap, metric, displayMonths]);

  // Resumo por loja (mesmas fórmulas exibidas na matriz) — usado no comparativo do WhatsApp
  const storeSummaries = useMemo(() => {
    return activeStores.map((s) => {
      let orcado = 0;
      let realizado = 0;
      let hasRealizado = false;
      for (const pm of displayMonths) {
        const g = goalMap.get(`${s.id}-${pm.month}`);
        if (g) orcado += metric === "faturamento" ? Number(g.meta_faturamento) : Number(g.meta_tc);
        const actual = actualMap.get(`${s.id}-${pm.month}`);
        const val = metric === "faturamento" ? actual?.revenue_actual : actual?.tc_actual;
        if (val != null) {
          realizado += Number(val);
          hasRealizado = true;
        }
      }
      const pct = hasRealizado && orcado > 0 ? (realizado / orcado) * 100 : null;
      return { id: s.id, name: s.name, orcado, realizado, hasRealizado, pct };
    });
  }, [activeStores, displayMonths, goalMap, actualMap, metric]);

  function copyComparativo() {
    const fmt = (v: number) => (metric === "faturamento" ? brl(v) : intFmt(v));
    const header =
      selectedMonth === 0
        ? `📊 COMPARATIVO DE METAS — ${year}`
        : `📊 COMPARATIVO DE METAS — ${(MONTHS[selectedMonth - 1] ?? "").toUpperCase()}/${year}`;

    const blocks = storeSummaries
      .filter((s) => s.orcado > 0 || s.hasRealizado)
      .map((s) =>
        [
          `🏪 ${s.name}`,
          `🎯 Orçado: ${s.orcado > 0 ? fmt(s.orcado) : "—"}`,
          `💰 Realizado: ${s.hasRealizado ? fmt(s.realizado) : "Não lançado"}`,
          `📈 Atingimento: ${s.pct !== null ? `${s.pct.toFixed(1)}%` : "—"}`,
        ].join("\n"),
      );

    if (!blocks.length) {
      toast.info("Nada para comparar", {
        description: "Não há metas nem faturamento realizado no período selecionado.",
      });
      return;
    }

    const totalLine = [
      "📌 TOTAL GERAL",
      `🎯 Orçado: ${grandTotals.grandOrcado > 0 ? fmt(grandTotals.grandOrcado) : "—"}`,
      `💰 Realizado: ${grandTotals.grandHasRealizado ? fmt(grandTotals.grandRealizado) : "Não lançado"}`,
      `📈 Atingimento: ${grandTotals.grandPct !== null ? `${grandTotals.grandPct.toFixed(1)}%` : "—"}`,
    ].join("\n");

    const message = [header, "", ...blocks, totalLine].join("\n\n");

    const done = () =>
      toast.success("Comparativo copiado!", {
        description: "Cole no WhatsApp para enviar.",
      });

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message).then(done).catch(() => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
    }
  }

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
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[150px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Ano completo</SelectItem>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
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
                  💰 Faturamento (R$)
                </Button>
                <Button
                  size="sm"
                  variant={metric === "tc" ? "default" : "ghost"}
                  className="h-8 text-xs font-semibold"
                  onClick={() => setMetric("tc")}
                >
                  👥 TC (Atendimentos)
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              title="Copiar comparativo do mês para WhatsApp"
              aria-label="Copiar comparativo do mês para WhatsApp"
              onClick={copyComparativo}
            >
              <MessageCircle className="size-4" />
            </Button>

            <Button
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["actuals-targets"] });
                qc.invalidateQueries({ queryKey: ["store-goals"] });
                qc.invalidateQueries({ queryKey: ["stores-metas"] });
                qc.refetchQueries();
                toast.success("Sincronização concluída com sucesso!", {
                  description: "Metas e faturamentos realizados atualizados diretamente do banco de dados.",
                });
              }}
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              🔄 SINCRONIZAR TODAS AS INFORMAÇÕES
            </Button>

            {isMaster && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-xs font-medium"
                  onClick={() => dedupMutation.mutate()}
                  disabled={dedupMutation.isPending}
                >
                  <RefreshCw className={cn("size-3.5 mr-1.5", dedupMutation.isPending && "animate-spin")} />
                  Padronizar Lojas
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold"
                  onClick={() => onImportActuals?.()}
                >
                  <Upload className="size-3.5 mr-1.5 text-primary" />
                  📥 Importar Faturamento Realizado
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo Consolidado do Período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. FATURAMENTO ORÇADO */}
        <Card className="p-4 border-l-4 border-l-primary bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {metric === "faturamento" ? `Meta Orçada Total (${selectedMonth === 0 ? "Jun–Dez" : MONTHS[selectedMonth - 1]})` : `Meta TC Orçada (${selectedMonth === 0 ? "Jun–Dez" : MONTHS[selectedMonth - 1]})`}
          </p>
          <p className="text-2xl font-black text-primary mt-1">
            {metric === "faturamento" ? brl(grandTotals.grandOrcado) : intFmt(grandTotals.grandOrcado)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Base {year - 1}: {metric === "faturamento" ? brl(totalPeriodMeta.baseFat) : intFmt(totalPeriodMeta.baseTc)} (+10%)
          </p>
        </Card>

        {/* 2. FATURAMENTO REALIZADO */}
        <Card className="p-4 border-l-4 border-l-emerald-500 bg-card">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
            {metric === "faturamento" ? "Faturamento Realizado" : "TC Realizado"}
          </p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {grandTotals.grandHasRealizado
              ? metric === "faturamento"
                ? brl(grandTotals.grandRealizado)
                : intFmt(grandTotals.grandRealizado)
              : "Não lançado"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {grandTotals.grandHasRealizado
              ? "Soma real individualizada das lojas"
              : "Aguardando importação"}
          </p>
        </Card>

        {/* 3. ATINGIMENTO DO GRUPO */}
        <Card className="p-4 border-l-4 border-l-sky-500 bg-card">
          <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase">
            Atingimento do Grupo
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-black text-sky-700 dark:text-sky-300">
              {grandTotals.grandPct !== null ? `${grandTotals.grandPct.toFixed(1)}%` : "—"}
            </p>
            {grandTotals.grandPct !== null && (
              <Badge variant="outline" className={cn("text-[10px] font-extrabold px-1.5 py-0.2", grandTotals.grandStatus.badgeClass)}>
                {grandTotals.grandStatus.icon} {grandTotals.grandStatus.label}
              </Badge>
            )}
          </div>
          {grandTotals.grandPct !== null && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className={cn("h-full transition-all duration-300 rounded-full", grandTotals.grandStatus.barColor)}
                style={{ width: `${Math.min(Math.max(grandTotals.grandPct, 0), 100)}%` }}
              />
            </div>
          )}
        </Card>

        {/* 4. DIFERENÇA / LACUNA */}
        <Card className="p-4 border-l-4 border-l-amber-500 bg-card">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">
            Diferença / Lacuna (Variação)
          </p>
          <p className={cn(
            "text-2xl font-black mt-1",
            grandTotals.grandGap === null
              ? "text-muted-foreground"
              : grandTotals.grandGap >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
          )}>
            {grandTotals.grandGap !== null
              ? `${grandTotals.grandGap >= 0 ? "+" : ""}${metric === "faturamento" ? brl(grandTotals.grandGap) : intFmt(grandTotals.grandGap)}`
              : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {grandTotals.grandGap !== null
              ? grandTotals.grandGap >= 0
                ? "Superávit em relação à meta"
                : "Déficit em relação à meta"
              : selectedMonth === 0 ? "7 meses (Junho a Dezembro)" : MONTHS[selectedMonth - 1]}
          </p>
        </Card>
      </div>

      {/* TABELA CONSOLIDADA GERAL: LOJA x ORÇADO x REALIZADO x GAP x % ATINGIMENTO x STATUS x TC x AÇÕES */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold">
                Orçamento de Metas (Matriz) — {metric === "faturamento" ? "Faturamento (R$)" : "TC (Atendimentos)"} {year}{selectedMonth !== 0 ? ` · ${MONTHS[selectedMonth - 1]}` : ""}
              </CardTitle>
              <CardDescription className="text-xs">
                Visualização unificada oficial com cruzamento automático Loja + Mês + Ano. Clique em uma loja para ver o detalhamento mês a mês.
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Clique em uma linha para detalhar
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 text-xs font-bold uppercase">
                <TableRow>
                  <TableHead className="w-[180px]">Loja</TableHead>
                  <TableHead className="text-right w-[140px]">Meta Orçada</TableHead>
                  <TableHead className="text-right w-[140px]">Realizado</TableHead>
                  <TableHead className="text-right w-[130px]">Variação</TableHead>
                  <TableHead className="text-right w-[150px]">% Atingimento</TableHead>
                  <TableHead className="text-center w-[130px]">Status Meta</TableHead>
                  <TableHead className="text-right w-[110px]">TC / Atend.</TableHead>
                  <TableHead className="text-center w-[170px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStores.map((s) => {
                  const isExpanded = expandedStoreId === s.id;
                  let storeOrcado = 0;
                  let storeRealizado = 0;
                  let storeTc = 0;
                  let storeHasRealizado = false;

                  for (const pm of displayMonths) {
                    const g = goalMap.get(`${s.id}-${pm.month}`);
                    if (g) {
                      storeOrcado += metric === "faturamento" ? Number(g.meta_faturamento) : Number(g.meta_tc);
                    }
                    const actual = actualMap.get(`${s.id}-${pm.month}`);
                    const rev = metric === "faturamento"
                      ? actual?.revenue_actual
                      : actual?.tc_actual;
                    if (rev != null) { storeRealizado += Number(rev); storeHasRealizado = true; }
                    if (actual?.tc_actual != null) { storeTc += Number(actual.tc_actual); }
                  }

                  const storeGap = storeHasRealizado && storeOrcado > 0 ? storeRealizado - storeOrcado : null;
                  const storePct = storeHasRealizado && storeOrcado > 0 ? (storeRealizado / storeOrcado) * 100 : null;

                  return (
                    <React.Fragment key={s.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/30 transition-colors",
                          isExpanded && "bg-muted/20 border-l-4 border-l-primary",
                          storePct !== null && storePct >= 90 && !isExpanded && "bg-emerald-50/30 dark:bg-emerald-950/10",
                          storePct !== null && storePct < 90 && !isExpanded && "bg-red-50/30 dark:bg-red-950/10",
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

                        {/* META ORÇADA */}
                        <TableCell className="text-right font-bold text-primary">
                          {storeOrcado > 0
                            ? metric === "faturamento" ? brl(storeOrcado) : intFmt(storeOrcado)
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* REALIZADO */}
                        <TableCell className="text-right font-semibold">
                          {storeHasRealizado ? (
                            <span className={cn(
                              storePct !== null && storePct >= 90 && "text-emerald-700 dark:text-emerald-400 font-bold",
                              storePct !== null && storePct < 90 && "text-red-700 dark:text-red-400 font-bold",
                            )}>
                              {metric === "faturamento" ? brl(storeRealizado) : intFmt(storeRealizado)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Não lançado</span>
                          )}
                        </TableCell>

                        {/* VARIAÇÃO */}
                        <TableCell className="text-right font-bold">
                          {storeGap !== null ? (
                            <span className={storeGap >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-700 dark:text-red-400"}>
                              {storeGap >= 0 ? "+" : ""}{metric === "faturamento" ? brl(storeGap) : intFmt(storeGap)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* % ATINGIMENTO */}
                        <TableCell className="text-right">
                          <AtingimentoIndicator pct={storePct} />
                        </TableCell>

                        {/* STATUS */}
                        <TableCell className="text-center">
                          <AtingimentoStatusBadge pct={storePct} />
                        </TableCell>

                        {/* TC / ATENDIMENTOS */}
                        <TableCell className="text-right font-medium text-xs">
                          {storeTc > 0 ? intFmt(storeTc) : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* AÇÕES (WHATSAPP + EXPANDIR) */}
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              title="Copiar metas para WhatsApp"
                              onClick={() =>
                                copyWhatsAppMessage({
                                  storeName: s.name,
                                  meta: storeOrcado,
                                  realizado: storeHasRealizado ? storeRealizado : null,
                                  tc: storeTc > 0 ? storeTc : null,
                                  pct: storePct,
                                  gap: storeGap,
                                  monthLabel: periodLabelText,
                                })
                              }
                            >
                              <Share2 className="size-3 mr-1 text-emerald-600" />
                              WhatsApp
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs font-semibold"
                              onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                            >
                              {isExpanded ? "Ocultar" : "Detalhar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Detalhamento mês a mês */}
                      {isExpanded && (
                        <TableRow className="bg-muted/10">
                          <TableCell colSpan={8} className="p-4">
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
                    </React.Fragment>
                  );
                })}

                {/* Linha de Totais Gerais Consolidados */}
                {activeStores.length > 0 && (
                  <TableRow className="bg-muted/60 font-extrabold border-t-2 text-sm">
                    <TableCell className="font-extrabold uppercase tracking-wide text-xs">TOTAL CONSOLIDADO</TableCell>
                    <TableCell className="text-right font-extrabold text-primary">
                      {grandTotals.grandOrcado > 0 ? (metric === "faturamento" ? brl(grandTotals.grandOrcado) : intFmt(grandTotals.grandOrcado)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-extrabold">
                      {grandTotals.grandHasRealizado ? (
                        <span className={cn(
                          grandTotals.grandPct !== null && grandTotals.grandPct >= 90 && "text-emerald-700 dark:text-emerald-400",
                          grandTotals.grandPct !== null && grandTotals.grandPct < 90 && "text-red-700 dark:text-red-400",
                        )}>
                          {metric === "faturamento" ? brl(grandTotals.grandRealizado) : intFmt(grandTotals.grandRealizado)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-extrabold">
                      {grandTotals.grandGap !== null ? (
                        <span className={grandTotals.grandGap >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                          {grandTotals.grandGap >= 0 ? "+" : ""}{metric === "faturamento" ? brl(grandTotals.grandGap) : intFmt(grandTotals.grandGap)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AtingimentoIndicator pct={grandTotals.grandPct} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AtingimentoStatusBadge pct={grandTotals.grandPct} />
                    </TableCell>
                    <TableCell className="text-right font-extrabold text-xs">
                      {grandTotals.grandTc > 0 ? intFmt(grandTotals.grandTc) : "—"}
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

    totalOrcado += orcado;
    if (realizado !== null) { totalRealizado += realizado; hasRealizado = true; }

    return { pm, goal, orcado, realizado, gap, pct };
  });

  const totalGap = hasRealizado ? totalRealizado - totalOrcado : null;
  const totalPct = hasRealizado && totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : null;
  const totalStatus = getAtingimentoStatus(totalPct);

  return (
    <Card className="border shadow-none bg-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span>{storeName} — Acompanhamento de Metas {year}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              <span className="inline-flex items-center gap-1 mr-3">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/40" />
                <strong>META OBRIGATÓRIA</strong> — Base oficial do cálculo de atingimento (editável pelo Master)
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted border border-muted-foreground/30" />
                Base {year - 1} (+10%)
              </span>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs font-bold border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
              onClick={() =>
                copyWhatsAppMessage({
                  storeName,
                  meta: totalOrcado,
                  realizado: hasRealizado ? totalRealizado : null,
                  tc: null,
                  pct: totalPct,
                  monthLabel: `Acumulado Jun–Dez/${year}`,
                })
              }
            >
              <Share2 className="size-3 mr-1 text-emerald-600" />
              Copiar WhatsApp
            </Button>
            {hasRealizado && (
              <Badge
                className={cn(
                  "font-bold text-xs px-3 py-1 shadow-sm",
                  totalStatus.badgeClass,
                )}
              >
                {totalStatus.icon} {totalStatus.label} ({totalPct?.toFixed(1)}%)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 text-xs font-semibold">
              <TableRow>
                <TableHead className="w-[110px]">Mês / Período</TableHead>
                <TableHead className="text-right w-[140px]">Base {year - 1}</TableHead>
                <TableHead className="text-right w-[150px] font-bold text-primary bg-primary/5">
                  Meta Obrigatória {year}
                </TableHead>
                <TableHead className="text-right w-[150px] font-bold">
                  Faturamento Realizado
                </TableHead>
                <TableHead className="text-right w-[130px]">Diferença (Gap)</TableHead>
                <TableHead className="text-right w-[160px]">% Atingimento</TableHead>
                <TableHead className="text-center w-[130px]">Status do Mês</TableHead>
                <TableHead className="text-center w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ pm, goal, orcado, realizado, gap, pct }) => (
                <TableRow
                  key={pm.month}
                  className={cn(
                    "text-xs transition-colors",
                    pct !== null && pct >= 90 && "bg-emerald-50/40 dark:bg-emerald-950/20",
                    pct !== null && pct < 90 && "bg-red-50/40 dark:bg-red-950/20",
                  )}
                >
                  <TableCell className="font-bold">
                    {pm.label} ({pm.full})
                  </TableCell>

                  {/* BASE ANO ANTERIOR */}
                  <TableCell className="text-right text-muted-foreground">
                    {goal?.faturamento_base_ano_anterior != null
                      ? brl(goal.faturamento_base_ano_anterior)
                      : "—"}
                  </TableCell>

                  {/* META OBRIGATÓRIA */}
                  <TableCell className="text-right font-extrabold text-primary bg-primary/5 text-xs">
                    {orcado > 0 ? brl(orcado) : <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  {/* FATURAMENTO REALIZADO */}
                  <TableCell className="text-right font-bold">
                    {realizado !== null ? (
                      <span className={cn(
                        pct !== null && pct >= 90 && "text-emerald-700 dark:text-emerald-400 font-extrabold",
                        pct !== null && pct < 90 && "text-red-700 dark:text-red-400 font-extrabold",
                      )}>
                        {brl(realizado)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Não lançado</span>
                    )}
                  </TableCell>

                  {/* GAP (DIFERENÇA) */}
                  <TableCell className="text-right font-bold">
                    {gap !== null ? (
                      <span className={gap >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                        {gap >= 0 ? "+" : ""}{brl(gap)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* % ATINGIMENTO */}
                  <TableCell className="text-right">
                    <AtingimentoIndicator pct={pct} compact />
                  </TableCell>

                  {/* STATUS */}
                  <TableCell className="text-center">
                    <AtingimentoStatusBadge pct={pct} />
                  </TableCell>

                  {/* AÇÕES (WHATSAPP + EDITAR) */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-emerald-600 hover:text-emerald-700"
                        title="Copiar mês para WhatsApp"
                        onClick={() =>
                          copyWhatsAppMessage({
                            storeName,
                            meta: orcado,
                            realizado,
                            tc: null,
                            pct,
                            monthLabel: `${pm.full}/${year}`,
                          })
                        }
                      >
                        <Share2 className="size-3.5" />
                      </Button>
                      {isMaster && goal && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-primary hover:text-primary"
                          title="Editar meta"
                          onClick={() =>
                            onEditGoal({
                              goalId: goal.id,
                              storeName,
                              storeId,
                              year,
                              month: pm.month,
                              faturamentoBase: Number(goal.faturamento_base_ano_anterior),
                              metaFaturamento: Number(goal.meta_faturamento),
                              tcBase: Number(goal.tc_ano_anterior),
                              metaTc: Number(goal.meta_tc),
                            })
                          }
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {/* Linha de Total da Loja */}
              <TableRow className="bg-muted/50 font-extrabold border-t-2">
                <TableCell className="font-extrabold uppercase">TOTAL {year}</TableCell>
                <TableCell className="text-right font-bold text-muted-foreground">
                  {brl(rows.reduce((s, r) => s + (Number(r.goal?.faturamento_base_ano_anterior) || 0), 0))}
                </TableCell>
                <TableCell className="text-right font-extrabold text-primary bg-primary/5">
                  {brl(totalOrcado)}
                </TableCell>
                <TableCell className="text-right font-extrabold">
                  {hasRealizado ? (
                    <span className={cn(
                      totalPct !== null && totalPct >= 90 && "text-emerald-700 dark:text-emerald-400",
                      totalPct !== null && totalPct < 90 && "text-red-700 dark:text-red-400",
                    )}>
                      {brl(totalRealizado)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-extrabold">
                  {totalGap !== null ? (
                    <span className={totalGap >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                      {totalGap >= 0 ? "+" : ""}{brl(totalGap)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-extrabold">
                  <AtingimentoIndicator pct={totalPct} compact />
                </TableCell>
                <TableCell className="text-center">
                  <AtingimentoStatusBadge pct={totalPct} />
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

/* ------------------------------------------------ Modal de Ajuste Manual da Meta */

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
  const [baseFat, setBaseFat] = useState(String(payload.faturamentoBase));
  const [baseTc, setBaseTc] = useState(String(payload.tcBase));
  const [reason, setReason] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () =>
      updateFn({
        data: {
          goal_id: payload.goalId,
          meta_faturamento: Number(metaFat),
          meta_tc: Number(metaTc),
          faturamento_base: Number(baseFat),
          tc_base: Number(baseTc),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Meta atualizada com sucesso!", {
        description: `Meta de ${payload.storeName} (${MONTHS[payload.month - 1]}/${payload.year}) ajustada e registrada na auditoria.`,
      });
      onSaved();
    },
    onError: (e: Error) => toast.error("Falha ao salvar meta", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Edit3 className="size-4 text-primary" />
            <span>Editar Meta — {payload.storeName}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Competência: <strong>{MONTHS[payload.month - 1]} / {payload.year}</strong>. Qualquer alteração fica gravada no log oficial de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="baseFat" className="text-xs font-semibold">
                Base Faturamento Anterior (R$)
              </Label>
              <Input
                id="baseFat"
                type="number"
                step="0.01"
                value={baseFat}
                onChange={(e) => setBaseFat(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metaFat" className="text-xs font-bold text-primary">
                Meta Faturamento Oficial (R$)
              </Label>
              <Input
                id="metaFat"
                type="number"
                step="0.01"
                value={metaFat}
                onChange={(e) => setMetaFat(e.target.value)}
                className="font-bold border-primary/50 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="baseTc" className="text-xs font-semibold">
                Base TC Anterior (Qtd)
              </Label>
              <Input
                id="baseTc"
                type="number"
                value={baseTc}
                onChange={(e) => setBaseTc(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metaTc" className="text-xs font-bold text-sky-600">
                Meta TC Oficial (Qtd)
              </Label>
              <Input
                id="metaTc"
                type="number"
                value={metaTc}
                onChange={(e) => setMetaTc(e.target.value)}
                className="font-bold border-sky-400 focus-visible:ring-sky-500"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="reason" className="text-xs font-semibold flex items-center gap-1">
              <span>Justificativa da Alteração</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Ex: Ajuste orçamentário aprovado pela diretoria; correção de lançamento retroativo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Obrigatório informar a justificativa para rastreabilidade em auditoria.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!reason.trim() || reason.trim().length < 3 || updateMutation.isPending}
            className="font-bold bg-primary"
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar Alteração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

type Step = "upload" | "review";

type EnhancedReviewRow = AutoImportedRow & {
  pctAting: number | null;
};

function ImportWizard({ initialMode = "realizado" }: { initialMode?: "realizado" | "meta" }) {
  const qc = useQueryClient();
  const nowYear = new Date().getFullYear();
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importRevenueHistory);
  const { data: stores } = useStores();

  const [importMode, setImportMode] = useState<"realizado" | "meta">(initialMode);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [baseYear, setBaseYear] = useState(nowYear);
  const [workbook, setWorkbook] = useState<any>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Goals from database to cross-reference budget / orçado in the review table
  const existingGoalsQuery = useQuery({
    queryKey: ["store-goals", baseYear],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("store_goals")
          .select("store_id, month, meta_faturamento, meta_tc, faturamento_base_ano_anterior")
          .eq("year", baseYear);
        if (error) {
          console.warn("store_goals query:", error);
          return [];
        }
        return data ?? [];
      } catch (err) {
        console.warn("store_goals fetch error:", err);
        return [];
      }
    },
  });

  const existingGoalsMap = useMemo(() => {
    const m = new Map<string, { meta_faturamento: number; meta_tc: number; base: number }>();
    for (const g of existingGoalsQuery.data ?? []) {
      m.set(`${g.store_id}-${g.month}`, {
        meta_faturamento: Number(g.meta_faturamento || 0),
        meta_tc: Number(g.meta_tc || 0),
        base: Number(g.faturamento_base_ano_anterior || 0),
      });
    }
    return m;
  }, [existingGoalsQuery.data]);

  // Automatic parsing result
  const autoResult = useMemo<AutoImportResult | null>(() => {
    if (!workbook) return null;
    try {
      return parseWorkbookAuto(workbook, baseYear, stores ?? [], overrides);
    } catch (e) {
      console.error("parseWorkbookAuto error:", e);
      return null;
    }
  }, [workbook, baseYear, stores, overrides]);

  async function onFile(file: File) {
    setIsLoadingFile(true);
    setLoadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true, raw: true });
      setWorkbook(wb);
      setFileName(file.name);
      setStep("review");
      toast.success("Planilha processada com sucesso!", {
        description: "Confira a tabela de conferência abaixo com todas as lojas identificadas.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido ao ler a planilha";
      setLoadError(msg);
      toast.error("Não foi possível ler a planilha", { description: msg });
    } finally {
      setIsLoadingFile(false);
    }
  }

  // Rows with merged budget from database if not present in file
  const reviewRows = useMemo<EnhancedReviewRow[]>(() => {
    if (!autoResult) return [];
    return autoResult.rows.map((r: AutoImportedRow) => {
      const dbGoal = r.storeId ? existingGoalsMap.get(`${r.storeId}-${r.month}`) : null;
      const orcado = r.faturamentoOrcado ?? dbGoal?.meta_faturamento ?? null;
      const realizado = r.faturamentoRealizado;
      const pctAting =
        realizado !== null && orcado !== null && orcado > 0
          ? (realizado / orcado) * 100
          : null;

      return {
        ...r,
        faturamentoOrcado: orcado,
        pctAting,
      };
    });
  }, [autoResult, existingGoalsMap]);

  const validRows = useMemo(() => reviewRows.filter((r: EnhancedReviewRow) => r.isValid && r.storeId), [reviewRows]);

  // Summaries
  const totals = useMemo(() => {
    let totalRealizado = 0;
    let totalOrcado = 0;
    const storeSet = new Set<string>();

    for (const r of validRows) {
      if (r.faturamentoRealizado) totalRealizado += r.faturamentoRealizado;
      if (r.faturamentoOrcado) totalOrcado += r.faturamentoOrcado;
      if (r.storeName) storeSet.add(r.storeName);
    }

    const overallPct = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : null;

    return {
      identifiedStoresCount: storeSet.size,
      totalRecords: validRows.length,
      totalRealizado,
      totalOrcado,
      overallPct,
    };
  }, [validRows]);

  const doSave = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) {
        throw new Error("Nenhum registro válido para salvar.");
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (importMode === "realizado") {
        let updatedCount = 0;

        for (const r of validRows) {
          // Check or create bonus_period
          let { data: period, error: pFindErr } = await supabase
            .from("bonus_periods")
            .select("id")
            .eq("store_id", r.storeId!)
            .eq("month", r.month)
            .eq("year", baseYear)
            .maybeSingle();

          if (pFindErr) {
            console.warn("Erro ao buscar período:", pFindErr);
          }

          if (!period) {
            const { data: newPeriod, error: pErr } = await supabase
              .from("bonus_periods")
              .insert({
                store_id: r.storeId!,
                month: r.month,
                year: baseYear,
                status: "aberto",
              })
              .select("id")
              .single();

            if (pErr) {
              console.error("Erro ao criar período:", pErr);
              continue;
            }
            period = newPeriod;
          }

          const { data: target } = await supabase
            .from("store_targets")
            .select("id")
            .eq("period_id", period.id)
            .maybeSingle();

          if (target) {
            const { error: updErr } = await supabase
              .from("store_targets")
              .update({
                revenue_actual: Number(r.faturamentoRealizado ?? 0),
                tc_actual: Number(r.tc ?? 0),
                updated_at: new Date().toISOString(),
              })
              .eq("id", target.id);
            if (updErr) throw new Error(updErr.message);
          } else {
            const { error: insErr } = await supabase
              .from("store_targets")
              .insert({
                period_id: period.id,
                revenue_actual: Number(r.faturamentoRealizado ?? 0),
                tc_actual: Number(r.tc ?? 0),
                target_calculated: 0,
              });
            if (insErr) throw new Error(insErr.message);
          }

          // 2. Grava também no revenue_history para garantir 100% de persistência
          const { data: existRev } = await supabase
            .from("revenue_history")
            .select("id")
            .eq("store_id", r.storeId!)
            .eq("year", baseYear)
            .eq("month", r.month)
            .maybeSingle();

          const revPayload = {
            store_id: r.storeId!,
            year: baseYear,
            month: r.month,
            receita_vendas: Number(r.faturamentoRealizado ?? 0),
            taxa_servico: 0,
            tc: Number(r.tc ?? 0),
            source_file: fileName || "Importação Faturamento Realizado",
            imported_at: new Date().toISOString(),
            imported_by: user?.id ?? null,
          };

          if (existRev) {
            await supabase.from("revenue_history").update(revPayload).eq("id", existRev.id);
          } else {
            await supabase.from("revenue_history").insert(revPayload);
          }

          updatedCount += 1;
        }

        if (user) {
          try {
            await supabase.from("audit_logs").insert({
              user_id: user.id,
              action: "importacao_realizado",
              entity: "store_targets",
              description: `Importação de faturamento realizado para ${baseYear}: ${updatedCount} registros gravados com sucesso.`,
            });
          } catch (auditErr) {
            console.warn("Audit log error:", auditErr);
          }
        }

        return {
          type: "realizado" as const,
          count: updatedCount,
        };
      } else {
        // Historical metas mode
        let importedCount = 0;

        // Base histórica do ano anterior: sempre a partir dos valores do PRÓPRIO arquivo
        // (coluna de base, quando existir; senão o total faturado do mês).
        const baseOf = (r: (typeof validRows)[number]) =>
          Number(r.faturamentoBaseAnoAnterior ?? r.faturamentoRealizado ?? r.faturamentoOrcado ?? 0);
        // Meses sem faturamento no histórico não geram meta (não inventar valores).
        const historyRows = validRows.filter((r) => baseOf(r) > 0);

        for (const r of historyRows) {
          const payload = {
            store_id: r.storeId!,
            year: baseYear - 1,
            month: r.month,
            receita_vendas: baseOf(r),
            taxa_servico: 0,
            tc: Number(r.tc ?? 0),
            source_file: fileName || null,
            imported_at: new Date().toISOString(),
            imported_by: user?.id ?? null,
          };

          const { data: prev } = await supabase
            .from("revenue_history")
            .select("id")
            .eq("store_id", r.storeId!)
            .eq("year", baseYear - 1)
            .eq("month", r.month)
            .maybeSingle();

          if (prev) {
            const { error } = await supabase.from("revenue_history").update(payload).eq("id", prev.id);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase.from("revenue_history").insert(payload);
            if (error) throw new Error(error.message);
          }
          importedCount += 1;
        }

        // Try server generate fallback
        try {
          await importFn({
            data: {
              base_year: baseYear - 1,
              replace: true,
              source_file: fileName || null,
              rows: historyRows.map((r) => ({
                store_id: r.storeId!,
                month: r.month,
                receita_vendas: baseOf(r),
                taxa_servico: 0,
                tc: Number(r.tc ?? 0),
              })),
            },
          });
        } catch (serverFnErr) {
          console.warn("Server importFn notice:", serverFnErr);
        }

        return {
          type: "meta" as const,
          count: importedCount,
          goals: importedCount,
        };
      }
    },
    onSuccess: (res) => {
      if (res.type === "realizado") {
        toast.success("Faturamento Realizado salvo com sucesso!", {
          description: `${res.count} registro(s) atualizados no sistema. O faturamento realizado agora é a fonte oficial para apuração.`,
        });
      } else {
        toast.success("Metas importadas e salvas com sucesso!", {
          description: `${res.count} registros salvos no banco de dados.`,
        });
      }

      setStep("upload");
      setWorkbook(null);
      setFileName("");

      // Atualização imediata do Realizado (sem F5): invalida e refaz as consultas
      void (async () => {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["actuals-targets"] }),
          qc.invalidateQueries({ queryKey: ["store-goals"] }),
          qc.invalidateQueries({ queryKey: ["stores-metas"] }),
        ]);
        await qc.refetchQueries({ queryKey: ["actuals-targets"], type: "all" });
        await qc.refetchQueries({ queryKey: ["store-goals"], type: "all" });
      })();
    },
    onError: (e: Error) => toast.error("Falha ao salvar importação", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      {/* 1. SELEÇÃO DO TIPO DE IMPORTAÇÃO E ANO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <span>Importação Automática de Faturamento e Metas</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Selecione o arquivo Excel ou CSV. O sistema identifica automaticamente todas as lojas, períodos, faturamentos e TC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
                <span>1. IMPORTAR FATURAMENTO REALIZADO (OFICIAL)</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Importa o faturamento real das lojas no ano ({nowYear}) para confronto com a meta e cálculo automático de bônus.
              </p>
            </div>

            <div
              onClick={() => {
                setImportMode("meta");
                setBaseYear(nowYear);
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
                <span>2. IMPORTAR HISTÓRICO / METAS</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Importa o histórico do ano base para definição das metas orçadas de cada loja.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ano de Referência</Label>
              <Select value={String(baseYear)} onValueChange={(v) => setBaseYear(Number(v))}>
                <SelectTrigger className="w-[140px] text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[nowYear - 2, nowYear - 1, nowYear, nowYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />

            <Button
              onClick={() => fileRef.current?.click()}
              disabled={isLoadingFile}
              className="font-bold text-xs"
            >
              {isLoadingFile ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" /> Processando Arquivo...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-1.5" /> Selecionar e Carregar Planilha Excel
                </>
              )}
            </Button>

            {fileName && (
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-2 rounded-md border">
                <FileSpreadsheet className="size-4 text-primary" /> {fileName}
              </span>
            )}
          </div>

          {loadError && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="size-4" />
              <AlertTitle>Erro ao ler o arquivo</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 2. ETAPA DE CONFERÊNCIA DAS METAS IMPORTADAS */}
      {step === "review" && autoResult && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Card com Estatísticas Globais */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <span>CONFERÊNCIA DAS METAS IMPORTADAS</span>
                </div>
                <Badge variant="outline" className="bg-background text-xs font-bold">
                  {importMode === "realizado" ? "Modo: Faturamento Realizado" : "Modo: Metas Orçadas"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Confira a lista detalhada de cada loja identificada com seus respectivos valores antes de efetivar o salvamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-background rounded-md p-3 border shadow-sm">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Lojas Identificadas</p>
                  <p className="text-xl font-black text-foreground mt-0.5">
                    {totals.identifiedStoresCount}{" "}
                    <span className="text-xs font-normal text-muted-foreground">loja(s)</span>
                  </p>
                </div>

                <div className="bg-background rounded-md p-3 border shadow-sm">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Registros Encontrados</p>
                  <p className="text-xl font-black text-foreground mt-0.5">
                    {totals.totalRecords}{" "}
                    <span className="text-xs font-normal text-muted-foreground">linha(s)</span>
                  </p>
                </div>

                <div className="bg-background rounded-md p-3 border shadow-sm">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Faturamento Orçado Total</p>
                  <p className="text-xl font-black text-foreground mt-0.5">
                    {brl(totals.totalOrcado)}
                  </p>
                </div>

                <div className="bg-background rounded-md p-3 border-2 border-emerald-600/30 shadow-sm">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                    Faturamento Realizado Total
                  </p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {brl(totals.totalRealizado)}
                  </p>
                </div>
              </div>

              {/* Alertas de Lojas Não Identificadas (se houver) */}
              {autoResult.unmappedStores.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Lojas não identificadas ({autoResult.unmappedStores.length})</AlertTitle>
                  <AlertDescription>
                    As seguintes lojas não foram encontradas no cadastro oficial e precisam ser vinculadas manualmente:
                    <div className="grid gap-2 sm:grid-cols-2 mt-2">
                      {autoResult.unmappedStores.map((unmapped: string) => (
                        <div key={unmapped} className="flex items-center gap-2 bg-background p-2 rounded border text-foreground">
                          <span className="font-semibold text-xs">{unmapped}:</span>
                          <Select
                            value={overrides[normalize(unmapped)] ?? ""}
                            onValueChange={(v) => setOverrides((o) => ({ ...o, [normalize(unmapped)]: v }))}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Vincular à loja..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(stores ?? []).map((s) => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Tabela de Conferência */}
          <Card>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Detalhamento por Loja e Período</CardTitle>
                <CardDescription className="text-xs">
                  Valores individuais que serão gravados como fonte oficial de Faturamento Realizado.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep("upload");
                    setWorkbook(null);
                  }}
                  className="text-xs h-8"
                >
                  Cancelar
                </Button>

                <Button
                  size="sm"
                  onClick={() => doSave.mutate()}
                  disabled={validRows.length === 0 || doSave.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-8 shadow-sm"
                >
                  {doSave.isPending ? "Gravando..." : importMode === "realizado" ? "SALVAR FATURAMENTO REALIZADO" : "SALVAR METAS IMPORTADAS"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto max-h-[500px]">
                <Table>
                  <TableHeader className="bg-muted/60 sticky top-0 z-10 text-xs font-bold uppercase">
                    <TableRow>
                      <TableHead className="w-[100px]">Filial</TableHead>
                      <TableHead className="w-[200px]">Loja</TableHead>
                      <TableHead className="w-[130px]">Período</TableHead>
                      <TableHead className="text-right w-[160px]">Faturamento Orçado</TableHead>
                      <TableHead className="text-right w-[180px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                        Faturamento Realizado
                      </TableHead>
                      <TableHead className="text-right w-[110px]">TC (Pedidos)</TableHead>
                      <TableHead className="text-right w-[120px]">% Atingimento</TableHead>
                      <TableHead className="text-center w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewRows.map((r: EnhancedReviewRow) => {
                      const isOk = r.isValid && r.storeId;
                      return (
                        <TableRow key={r.id} className={cn("text-xs", !isOk && "bg-destructive/5")}>
                          <TableCell className="font-bold text-muted-foreground">{r.code || "—"}</TableCell>
                          <TableCell className="font-semibold">{r.storeName}</TableCell>
                          <TableCell className="font-medium text-muted-foreground">
                            {MONTHS[r.month - 1] ?? `Mês ${r.month}`}/{r.year}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {r.faturamentoOrcado !== null ? brl(r.faturamentoOrcado) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 text-xs">
                            {r.faturamentoRealizado !== null ? brl(r.faturamentoRealizado) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {r.tc !== null ? intFmt(r.tc) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <AtingimentoIndicator pct={r.pctAting} compact />
                          </TableCell>
                          <TableCell className="text-center">
                            {isOk ? (
                              <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                                ✓ OK
                              </Badge>
                            ) : (
                              <div className="space-y-1">
                                <Badge variant="destructive" className="font-bold text-[10px]">
                                  {r.statusText}
                                </Badge>
                                {r.errors.length > 0 && (
                                  <p className="text-[10px] leading-tight text-destructive font-medium max-w-[220px] mx-auto">
                                    {r.errors.join(" • ")}
                                  </p>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Botão de Gravação Principal */}
          <div className="flex justify-end p-2">
            <Button
              size="lg"
              onClick={() => doSave.mutate()}
              disabled={validRows.length === 0 || doSave.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-8 py-3 shadow-md"
            >
              {doSave.isPending
                ? "Gravando Registros..."
                : importMode === "realizado"
                  ? "SALVAR FATURAMENTO REALIZADO"
                  : "SALVAR METAS IMPORTADAS"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
