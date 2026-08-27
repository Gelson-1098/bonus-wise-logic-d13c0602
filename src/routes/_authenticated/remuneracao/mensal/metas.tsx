import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, RefreshCw, Upload, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateGoals, getGoalGrowth, importRevenueHistory, saveGoalGrowth } from "@/lib/goals.functions";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export const Route = createFileRoute("/_authenticated/remuneracao/mensal/metas")({
  head: () => ({
    meta: [
      { title: "Metas de faturamento e TC | PRISMA" },
      {
        name: "description",
        content:
          "Importe o faturamento do ano anterior, gere automaticamente as metas de faturamento e de clientes atendidos e acompanhe a meta de cada loja.",
      },
      { property: "og:title", content: "Metas de faturamento e TC | PRISMA" },
      {
        property: "og:description",
        content: "Importe o faturamento do ano anterior, gere automaticamente as metas de faturamento e de clientes atendidos e acompanhe a meta de cada loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetasPage,
});

const intFmt = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function MetasPage() {
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;

  return (
    <AppShell
      title="Metas"
      description={
        isMaster
          ? "Importação do faturamento do ano anterior e geração automática das metas"
          : "Meta de faturamento e de clientes atendidos da sua loja"
      }
    >
      {isMaster ? <MasterMetas /> : <ManagerMetas />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ Master */

function MasterMetas() {
  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard">Metas geradas</TabsTrigger>
        <TabsTrigger value="importar">Importar faturamento</TabsTrigger>
        <TabsTrigger value="config">Crescimento</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        <GoalsDashboard />
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

function useStores() {
  return useQuery({
    queryKey: ["stores-metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id,name,code").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

function GoalsDashboard() {
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
            Metas {year} — base {year - 1}
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
                      Nenhuma meta gerada para {year}. Importe o faturamento de {year - 1} na aba ao lado.
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

/* ----------------------------------------------------------- Gerente view */

function ManagerMetas() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const goals = useQuery({
    queryKey: ["my-goals", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_goals")
        .select("id,store_id,year,month,meta_faturamento,meta_tc,stores(name)")
        .eq("year", year)
        .order("month");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const actuals = useQuery({
    queryKey: ["my-actuals", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_periods")
        .select("store_id,month,year,store_targets(revenue_actual,tc_actual)")
        .eq("year", year);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const actualMap = useMemo(() => {
    const m = new Map<string, { revenue_actual: number | null; tc_actual: number | null }>();
    for (const p of actuals.data ?? []) {
      const t = p.store_targets as unknown as {
        revenue_actual: number | null;
        tc_actual: number | null;
      } | null;
      if (t) m.set(`${p.store_id}-${p.month}`, t);
    }
    return m;
  }, [actuals.data]);

  const nowYear = now.getFullYear();

  // Encontra o registro do mês atual ou mais recente para destacar no banner
  const currentMonthGoal = useMemo(() => {
    const list = goals.data ?? [];
    return list.find((g) => g.month === now.getMonth() + 1) || list[list.length - 1] || null;
  }, [goals.data]);

  const currentActual = currentMonthGoal ? actualMap.get(`${currentMonthGoal.store_id}-${currentMonthGoal.month}`) : null;
  const currentAttainment =
    currentActual?.revenue_actual != null && Number(currentMonthGoal?.meta_faturamento) > 0
      ? (Number(currentActual.revenue_actual) / Number(currentMonthGoal?.meta_faturamento)) * 100
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
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
      </div>

      {currentMonthGoal && currentAttainment !== null && (
        <Alert
          className={
            currentAttainment >= 90
              ? "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-destructive/60 bg-destructive/10 text-destructive dark:text-destructive-foreground"
          }
        >
          {currentAttainment >= 90 ? (
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="size-5 text-destructive" />
          )}
          <div className="space-y-1">
            <AlertTitle className="text-base font-bold flex items-center gap-2">
              <span>{periodLabel(currentMonthGoal.month, currentMonthGoal.year)}:</span>
              <Badge
                className={
                  currentAttainment >= 90
                    ? "bg-emerald-600 text-white border-none font-bold"
                    : "bg-destructive text-white border-none font-bold"
                }
              >
                {currentAttainment >= 90 ? "ELEGÍVEL" : "INELEGÍVEL"}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-sm">
              {currentAttainment >= 90
                ? `A loja atingiu ${currentAttainment.toFixed(2)}% da meta e está ELEGÍVEL ao valor integral do bônus (gatilho ≥ 90%).`
                : `A loja atingiu ${currentAttainment.toFixed(2)}% da meta, ficando abaixo do gatilho mínimo de 90%. A loja está INELEGÍVEL ao bônus neste período.`}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta da minha loja</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Meta de faturamento</TableHead>
                  <TableHead className="text-right">Faturamento realizado</TableHead>
                  <TableHead className="text-right">% Faturamento</TableHead>
                  <TableHead className="text-center">Elegibilidade</TableHead>
                  <TableHead className="text-right">Meta de TC</TableHead>
                  <TableHead className="text-right">TC realizado</TableHead>
                  <TableHead className="text-right">% TC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(goals.data ?? []).map((g) => {
                  const a = actualMap.get(`${g.store_id}-${g.month}`);
                  const fatPct =
                    a?.revenue_actual != null && Number(g.meta_faturamento) > 0
                      ? (Number(a.revenue_actual) / Number(g.meta_faturamento)) * 100
                      : null;
                  const tcPct =
                    a?.tc_actual != null && Number(g.meta_tc) > 0
                      ? (Number(a.tc_actual) / Number(g.meta_tc)) * 100
                      : null;
                  const isEligible = fatPct !== null ? fatPct >= 90 : null;

                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        {(g.stores as { name: string } | null)?.name ?? "—"}
                      </TableCell>
                      <TableCell>{periodLabel(g.month, g.year)}</TableCell>
                      <TableCell className="text-right font-semibold">{brl(g.meta_faturamento)}</TableCell>
                      <TableCell className="text-right">
                        {a?.revenue_actual != null ? brl(a.revenue_actual) : "—"}
                      </TableCell>
                      <TableCell
                        className={
                          fatPct === null
                            ? "text-right"
                            : fatPct >= 90
                              ? "text-right font-bold text-emerald-600 dark:text-emerald-400"
                              : "text-right font-bold text-destructive"
                        }
                      >
                        {fatPct === null ? "—" : `${fatPct.toFixed(1)}%`}
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
                      <TableCell className="text-right font-semibold">{intFmt(g.meta_tc)}</TableCell>
                      <TableCell className="text-right">
                        {a?.tc_actual != null ? intFmt(a.tc_actual) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {tcPct === null ? "—" : `${tcPct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(goals.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Nenhuma meta publicada para {year}. Fale com o administrador.
                    </TableCell>
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
