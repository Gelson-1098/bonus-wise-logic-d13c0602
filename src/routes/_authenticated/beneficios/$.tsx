import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  Gift,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Unlock,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { brl, MONTHS } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  computeBenefitCalculations,
  deleteBenefitEntry,
  getBenefitEntries,
  getBenefitParameters,
  getBenefitPeriodStatuses,
  resetBenefitsToSpreadsheetBaseline,
  saveBenefitEntry,
  saveBenefitParameters,
  toggleBenefitPeriodStatus,
} from "@/lib/benefits.functions";
import type { BenefitEntry, BenefitParameter } from "@/lib/benefits-initial-data";

export const Route = createFileRoute("/_authenticated/beneficios/$")({
  head: () => ({
    meta: [
      { title: "Gestão Mensal de Benefícios | PRISMA" },
      {
        name: "description",
        content: "Controle e apuração mensal de VR e VT por loja e colaborador com base nas regras regionais da PRISMA.",
      },
    ],
  }),
  component: BeneficiosPage,
});

const ALL_SYSTEM_STORES = [
  { name: "Vila Clementino", region: "SP", city: "São Paulo" },
  { name: "Jabaquara", region: "SP", city: "São Paulo" },
  { name: "Spoleto Jabaquara", region: "SP", city: "São Paulo" },
  { name: "Campo Belo", region: "SP", city: "São Paulo" },
  { name: "Guarulhos Gopoúva", region: "GRU", city: "Guarulhos" },
  { name: "Parque Mandaqui", region: "SP", city: "São Paulo" },
  { name: "Aeroporto de Guarulhos", region: "GRU", city: "Guarulhos" },
  { name: "Pinheiros", region: "SP", city: "São Paulo" },
  { name: "Aclimação", region: "SP", city: "São Paulo" },
  { name: "Serra", region: "ES", city: "Serra" },
  { name: "Jardim Camburi", region: "ES", city: "Vitória" },
  { name: "Praia do Canto", region: "ES", city: "Vitória" },
];

export function BeneficiosPage() {
  const qc = useQueryClient();
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;

  const getEntriesFn = useServerFn(getBenefitEntries);
  const getParamsFn = useServerFn(getBenefitParameters);
  const getStatusesFn = useServerFn(getBenefitPeriodStatuses);
  const saveEntryFn = useServerFn(saveBenefitEntry);
  const deleteEntryFn = useServerFn(deleteBenefitEntry);
  const toggleStatusFn = useServerFn(toggleBenefitPeriodStatus);
  const saveParamsFn = useServerFn(saveBenefitParameters);
  const resetBaselineFn = useServerFn(resetBenefitsToSpreadsheetBaseline);

  const [activeTab, setActiveTab] = useState<"lancamentos" | "consolidado" | "parametros">("lancamentos");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedStore, setSelectedStore] = useState<string>("Vila Clementino");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [editingEntry, setEditingEntry] = useState<BenefitEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Queries
  const entriesQuery = useQuery({
    queryKey: ["benefit-entries", year],
    queryFn: () => getEntriesFn({ data: { year } }),
  });

  const paramsQuery = useQuery({
    queryKey: ["benefit-parameters"],
    queryFn: () => getParamsFn(),
  });

  const statusesQuery = useQuery({
    queryKey: ["benefit-statuses", year],
    queryFn: () => getStatusesFn({ data: { year } }),
  });

  const allEntries = entriesQuery.data ?? [];
  const parameters = paramsQuery.data ?? [];
  const periodStatuses = statusesQuery.data ?? {};

  // Store access filtering for managers
  const availableStores = useMemo(() => {
    return ALL_SYSTEM_STORES.map((s) => s.name);
  }, []);

  // Entries filtered for the current view
  const currentMonthEntries = useMemo(() => {
    return allEntries.filter((e) => e.month === month && e.storeName.toLowerCase() === selectedStore.toLowerCase());
  }, [allEntries, month, selectedStore]);

  const filteredCollaborators = useMemo(() => {
    if (!searchTerm.trim()) return currentMonthEntries;
    const term = searchTerm.toLowerCase();
    return currentMonthEntries.filter((e) => e.collaborator.toLowerCase().includes(term));
  }, [currentMonthEntries, searchTerm]);

  // Current store period status
  const currentPeriodKey = `${selectedStore}-${month}`;
  const isPeriodClosed = periodStatuses[currentPeriodKey] === "fechado";

  // Summary calculations for the active store & month
  const storeSummary = useMemo(() => {
    let totalBeneficios = 0;
    let totalVr = 0;
    let totalVt = 0;
    let totalAditivos = 0;
    let count = currentMonthEntries.length;

    for (const e of currentMonthEntries) {
      totalBeneficios += Number(e.totalBeneficios || 0);
      totalVr += Number(e.totalVr || 0);
      totalVt += Number(e.totalVt || 0);
      totalAditivos += Number(e.aditivoVr || 0) + Number(e.aditivoVt || 0);
    }

    const avgPerPerson = count > 0 ? totalBeneficios / count : 0;

    return { totalBeneficios, totalVr, totalVt, totalAditivos, count, avgPerPerson };
  }, [currentMonthEntries]);

  // Consolidated table calculations: 12 stores x 12 months
  const consolidatedMatrix = useMemo(() => {
    const matrix: Record<string, { monthlyTotals: number[]; monthlyCounts: number[]; annualTotal: number; avgPerson: number }> = {};

    ALL_SYSTEM_STORES.forEach((s) => {
      matrix[s.name] = {
        monthlyTotals: Array(12).fill(0),
        monthlyCounts: Array(12).fill(0),
        annualTotal: 0,
        avgPerson: 0,
      };
    });

    for (const e of allEntries) {
      const storeKey = ALL_SYSTEM_STORES.find(
        (s) => s.name.toLowerCase() === e.storeName.toLowerCase()
      )?.name || e.storeName;

      if (!matrix[storeKey]) {
        matrix[storeKey] = {
          monthlyTotals: Array(12).fill(0),
          monthlyCounts: Array(12).fill(0),
          annualTotal: 0,
          avgPerson: 0,
        };
      }

      if (e.month >= 1 && e.month <= 12 && matrix[storeKey]) {
        const row = matrix[storeKey];
        if (row && row.monthlyTotals) {
          row.monthlyTotals[e.month - 1] = (row.monthlyTotals[e.month - 1] ?? 0) + Number(e.totalBeneficios || 0);
          row.monthlyCounts[e.month - 1] = (row.monthlyCounts[e.month - 1] ?? 0) + 1;
          row.annualTotal += Number(e.totalBeneficios || 0);
        }
      }
    }

    return matrix;
  }, [allEntries]);

  // Total per month across all stores
  const grandMonthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    let grandAnnual = 0;

    Object.values(consolidatedMatrix).forEach((row) => {
      row.monthlyTotals.forEach((val, idx) => {
        totals[idx] += val;
        grandAnnual += val;
      });
    });

    return { totals, grandAnnual };
  }, [consolidatedMatrix]);

  // Mutations
  const saveEntryMutation = useMutation({
    mutationFn: (data: any) => saveEntryFn({ data }),
    onSuccess: () => {
      toast.success("Lançamento de benefício salvo com sucesso!");
      setEditingEntry(null);
      qc.invalidateQueries({ queryKey: ["benefit-entries"] });
    },
    onError: (err: any) => toast.error("Erro ao salvar lançamento", { description: err.message }),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => deleteEntryFn({ data: { id, year } }),
    onSuccess: () => {
      toast.success("Colaborador removido do período!");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["benefit-entries"] });
    },
    onError: (err: any) => toast.error("Erro ao remover", { description: err.message }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (newStatus: "estimado" | "fechado") =>
      toggleStatusFn({ data: { year, month, storeName: selectedStore, status: newStatus } }),
    onSuccess: (_, newStatus) => {
      toast.success(
        newStatus === "fechado"
          ? `Mês ${MONTHS[(month || 1) - 1] ?? "Mês"} de ${selectedStore} FECHADO!`
          : `Mês ${MONTHS[(month || 1) - 1] ?? "Mês"} de ${selectedStore} REABERTO como ESTIMADO!`
      );
      qc.invalidateQueries({ queryKey: ["benefit-statuses"] });
    },
    onError: (err: any) => toast.error("Erro ao alterar status", { description: err.message }),
  });

  const saveParamsMutation = useMutation({
    mutationFn: (parameters: BenefitParameter[]) => saveParamsFn({ data: { parameters } }),
    onSuccess: () => {
      toast.success("Parâmetros de benefícios salvos com sucesso!");
      qc.invalidateQueries({ queryKey: ["benefit-parameters"] });
    },
    onError: (err: any) => toast.error("Erro ao salvar parâmetros", { description: err.message }),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetBaselineFn({ data: { year } }),
    onSuccess: (res) => {
      toast.success(`Base restaurada com sucesso: ${res.count} registros carregados.`);
      setConfirmReset(false);
      qc.invalidateQueries();
    },
    onError: (err: any) => toast.error("Erro ao restaurar", { description: err.message }),
  });

  // Open modal to add new collaborator
  function handleAddNewCollaborator() {
    const storeObj = ALL_SYSTEM_STORES.find((s) => s.name.toLowerCase() === selectedStore.toLowerCase());
    const region = storeObj?.region || "SP";

    // Detect default VR for region
    let defaultVr = 39.13;
    if (region === "GRU") defaultVr = 42.96;
    if (region === "ES" || selectedStore.includes("Spoleto")) defaultVr = 25.00;

    // Detect default VT for region
    let defaultVtMensal = 411.13;
    if (region === "GRU") defaultVtMensal = 315.00;
    if (region === "ES") defaultVtMensal = 257.53;

    const newRecord: BenefitEntry = {
      id: "",
      storeName: selectedStore,
      collaborator: "",
      year,
      month,
      diasMes: 30,
      folgas: 5,
      diasDevidos: 25,
      valorVr: defaultVr,
      totalVr: defaultVr * 25,
      vtDiarista: 0,
      vtMensalista: defaultVtMensal,
      depositoDiario: 0,
      totalVt: defaultVtMensal,
      aditivoVt: 0,
      aditivoVr: 0,
      obs: "",
      totalBeneficios: defaultVr * 25 + defaultVtMensal,
    };

    setIsNewEntry(true);
    setEditingEntry(newRecord);
  }

  const currentMonthLabel = MONTHS[(month || 1) - 1] ?? "Mês";

  return (
    <AppShell
      title="Benefícios Mensais"
      description="Controle e apuração de Vale Refeição e Vale Transporte por loja e colaborador."
    >
      <div className="space-y-6">
        {/* Barra Superior de Controles: Ano e Ações Master */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-primary" />
            <span className="font-bold text-base">Painel de Gestão de Benefícios</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Ano:</span>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-7 w-20 border-0 bg-transparent font-bold text-xs p-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isMaster && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-dashed text-muted-foreground hover:text-foreground"
                onClick={() => setConfirmReset(true)}
              >
                <RefreshCw className="size-3.5 mr-1" /> Restaurar Planilha Base
              </Button>
            )}
          </div>
        </div>

        {/* Abas Principais */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="lancamentos" className="text-xs font-semibold">
              <FileSpreadsheet className="size-3.5 mr-1.5" /> Lançamentos
            </TabsTrigger>
            <TabsTrigger value="consolidado" className="text-xs font-semibold">
              <Building2 className="size-3.5 mr-1.5" /> Consolidado
            </TabsTrigger>
            {isMaster && (
              <TabsTrigger value="parametros" className="text-xs font-semibold">
                <Settings2 className="size-3.5 mr-1.5" /> Regras & Parâmetros
              </TabsTrigger>
            )}
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: LANÇAMENTOS MENSAIS POR LOJA                                       */}
          {/* ========================================================================= */}
          <TabsContent value="lancamentos" className="space-y-4">
            {/* Barra de Filtros: Mês, Loja, Status do Período */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Seletor de Loja */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Loja
                      </Label>
                      <Select value={selectedStore} onValueChange={setSelectedStore}>
                        <SelectTrigger className="w-[200px] h-9 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStores.map((st) => (
                            <SelectItem key={st} value={st} className="text-xs">
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Seletor de Mês */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Mês de Competência
                      </Label>
                      <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                        <SelectTrigger className="w-[170px] h-9 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((mName, idx) => (
                            <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                              {mName.toUpperCase()} / {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status do Período */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Status do Mês
                      </Label>
                      <div className="flex items-center h-9">
                        {isPeriodClosed ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1 flex items-center gap-1 shadow-sm">
                            <Lock className="size-3" /> FECHADO
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs px-2.5 py-1 flex items-center gap-1">
                            <Clock className="size-3" /> ESTIMADO (ABERTO)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações de Topo: Fechar/Reabrir Período & Adicionar Colaborador */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isMaster && (
                      <Button
                        variant={isPeriodClosed ? "outline" : "default"}
                        size="sm"
                        className="h-9 text-xs font-semibold"
                        onClick={() => toggleStatusMutation.mutate(isPeriodClosed ? "estimado" : "fechado")}
                        disabled={toggleStatusMutation.isPending}
                      >
                        {isPeriodClosed ? (
                          <>
                            <Unlock className="size-3.5 mr-1.5 text-amber-600" /> Reabrir Mês
                          </>
                        ) : (
                          <>
                            <Lock className="size-3.5 mr-1.5" /> Fechar Mês
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={handleAddNewCollaborator}
                      disabled={isPeriodClosed && !isMaster}
                      className="h-9 text-xs font-bold"
                    >
                      <Plus className="size-3.5 mr-1" /> Adicionar Colaborador
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cards de Resumo da Loja no Mês */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="bg-primary/5 border-primary/20 shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Benefícios</p>
                  <p className="text-lg font-black text-primary mt-0.5">{brl(storeSummary.totalBeneficios)}</p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total VR</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{brl(storeSummary.totalVr)}</p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total VT</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{brl(storeSummary.totalVt)}</p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Aditivos</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {brl(storeSummary.totalAditivos)}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Colaboradores</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{storeSummary.count}</p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Média / Pessoa</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{brl(storeSummary.avgPerPerson)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Colaboradores e Benefícios */}
            <Card>
              <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <span>
                      {selectedStore} — {currentMonthLabel.toUpperCase()}/{year}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Cálculos automáticos: Dias Devidos = Dias − Folgas · Total VR = VR × Dias Devidos + Aditivo · Total VT = Mensal + Diário + Aditivo
                  </CardDescription>
                </div>

                <div className="relative w-48">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 text-[11px] font-bold uppercase sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[180px]">COLABORADOR</TableHead>
                        <TableHead className="text-center w-[70px]">DIAS</TableHead>
                        <TableHead className="text-center w-[70px]">FOLGAS</TableHead>
                        <TableHead className="text-center w-[70px] text-primary">DEVIDOS</TableHead>
                        <TableHead className="text-right w-[85px]">VR DIA</TableHead>
                        <TableHead className="text-right w-[100px]">TOTAL VR</TableHead>
                        <TableHead className="text-right w-[85px]">VT DIÁR.</TableHead>
                        <TableHead className="text-right w-[100px]">VT MENS.</TableHead>
                        <TableHead className="text-right w-[95px]">DEP. DIÁRIO</TableHead>
                        <TableHead className="text-right w-[80px]">ADIT. VT</TableHead>
                        <TableHead className="text-right w-[80px]">ADIT. VR</TableHead>
                        <TableHead className="text-right w-[100px]">TOTAL VT</TableHead>
                        <TableHead className="text-center w-[120px]">OBSERVAÇÃO</TableHead>
                        <TableHead className="text-right w-[125px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                          VALOR A RECEBER
                        </TableHead>
                        <TableHead className="text-center w-[80px]">AÇÕES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entriesQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={15} className="text-center py-8 text-xs text-muted-foreground">
                            Carregando benefícios da loja...
                          </TableCell>
                        </TableRow>
                      ) : filteredCollaborators.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={15} className="text-center py-8 text-xs text-muted-foreground">
                            Nenhum colaborador lançado para esta loja no mês de {currentMonthLabel}.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCollaborators.map((entry) => (
                          <TableRow key={entry.id} className="text-xs hover:bg-muted/20 transition-colors">
                            {/* Nome */}
                            <TableCell className="font-semibold flex items-center gap-1.5 py-2.5">
                              <User className="size-3.5 text-muted-foreground shrink-0" />
                              <span>{entry.collaborator}</span>
                            </TableCell>

                            {/* Dias do mês */}
                            <TableCell className="text-center font-medium">{entry.diasMes}</TableCell>

                            {/* Folgas */}
                            <TableCell className="text-center font-medium text-muted-foreground">
                              {entry.folgas}
                            </TableCell>

                            {/* Dias Devidos */}
                            <TableCell className="text-center font-bold text-primary bg-primary/5">
                              {entry.diasDevidos}
                            </TableCell>

                            {/* VR Diário */}
                            <TableCell className="text-right">{brl(entry.valorVr)}</TableCell>

                            {/* Total VR */}
                            <TableCell className="text-right font-medium">{brl(entry.totalVr)}</TableCell>

                            {/* VT Diarista */}
                            <TableCell className="text-right text-muted-foreground">
                              {entry.vtDiarista > 0 ? brl(entry.vtDiarista) : "—"}
                            </TableCell>

                            {/* VT Mensalista */}
                            <TableCell className="text-right text-muted-foreground">
                              {entry.vtMensalista > 0 ? brl(entry.vtMensalista) : "—"}
                            </TableCell>

                            {/* Depósito Diário */}
                            <TableCell className="text-right text-muted-foreground">
                              {entry.depositoDiario > 0 ? brl(entry.depositoDiario) : "—"}
                            </TableCell>

                            {/* Aditivo VT */}
                            <TableCell className="text-right">
                              {entry.aditivoVt > 0 ? (
                                <span className="text-amber-700 dark:text-amber-400 font-medium">
                                  +{brl(entry.aditivoVt)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            {/* Aditivo VR */}
                            <TableCell className="text-right">
                              {entry.aditivoVr > 0 ? (
                                <span className="text-amber-700 dark:text-amber-400 font-medium">
                                  +{brl(entry.aditivoVr)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            {/* Total VT */}
                            <TableCell className="text-right font-medium">{brl(entry.totalVt)}</TableCell>

                            {/* Observação */}
                            <TableCell className="text-center">
                              {entry.obs ? (
                                <Badge variant="outline" className="text-[10px] max-w-[110px] truncate">
                                  {entry.obs}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </TableCell>

                            {/* VALOR A RECEBER */}
                            <TableCell className="text-right font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs">
                              {brl(entry.totalBeneficios)}
                            </TableCell>

                            {/* Ações */}
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-primary"
                                  onClick={() => {
                                    setIsNewEntry(false);
                                    setEditingEntry(entry);
                                  }}
                                  disabled={isPeriodClosed && !isMaster}
                                >
                                  <Edit3 className="size-3.5" />
                                </Button>
                                {(isMaster || !isPeriodClosed) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingId(entry.id)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}

                      {/* Linha de Total da Loja */}
                      {filteredCollaborators.length > 0 && (
                        <TableRow className="bg-muted/70 font-bold border-t-2 text-xs">
                          <TableCell className="font-extrabold uppercase">TOTAL DA LOJA ({filteredCollaborators.length})</TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-right font-extrabold">{brl(storeSummary.totalVr)}</TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-right font-extrabold text-amber-700 dark:text-amber-400">
                            {storeSummary.totalAditivos > 0 ? brl(storeSummary.totalAditivos) : "—"}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right font-extrabold">{brl(storeSummary.totalVt)}</TableCell>
                          <TableCell />
                          <TableCell className="text-right font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/40 text-sm">
                            {brl(storeSummary.totalBeneficios)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: VISÃO CONSOLIDADA MENSAL E ANUAL                                  */}
          {/* ========================================================================= */}
          <TabsContent value="consolidado" className="space-y-6">
            {/* Resumo Consolidado do Mês Atual Selecionado */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <span>
                    Consolidado Mensal por Loja — {currentMonthLabel.toUpperCase()}/{year}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Valores apurados para cada loja no mês de competência selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 text-xs font-bold uppercase">
                      <TableRow>
                        <TableHead>LOJA</TableHead>
                        <TableHead className="text-center">COLABORADORES</TableHead>
                        <TableHead className="text-right">TOTAL VR</TableHead>
                        <TableHead className="text-right">TOTAL VT</TableHead>
                        <TableHead className="text-right">ADITIVOS</TableHead>
                        <TableHead className="text-right font-extrabold text-primary">TOTAL BENEFÍCIOS</TableHead>
                        <TableHead className="text-center">STATUS DO MÊS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_SYSTEM_STORES.map((st) => {
                        const stEntries = allEntries.filter(
                          (e) => e.month === month && e.storeName.toLowerCase() === st.name.toLowerCase()
                        );
                        let vr = 0;
                        let vt = 0;
                        let adit = 0;
                        let total = 0;
                        for (const e of stEntries) {
                          vr += Number(e.totalVr || 0);
                          vt += Number(e.totalVt || 0);
                          adit += Number(e.aditivoVr || 0) + Number(e.aditivoVt || 0);
                          total += Number(e.totalBeneficios || 0);
                        }
                        const stClosed = periodStatuses[`${st.name}-${month}`] === "fechado";

                        return (
                          <TableRow
                            key={st.name}
                            className="text-xs hover:bg-muted/20 cursor-pointer"
                            onClick={() => {
                              setSelectedStore(st.name);
                              setActiveTab("lancamentos");
                            }}
                          >
                            <TableCell className="font-semibold">{st.name}</TableCell>
                            <TableCell className="text-center font-medium">{stEntries.length}</TableCell>
                            <TableCell className="text-right">{vr > 0 ? brl(vr) : "—"}</TableCell>
                            <TableCell className="text-right">{vt > 0 ? brl(vt) : "—"}</TableCell>
                            <TableCell className="text-right text-amber-700 dark:text-amber-400">
                              {adit > 0 ? brl(adit) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-black text-primary text-xs">
                              {total > 0 ? brl(total) : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {stClosed ? (
                                <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5">
                                  FECHADO
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300 font-bold text-[10px] px-2 py-0.5">
                                  ESTIMADO
                                </Badge>
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

            {/* Matriz Anual: 12 Meses x Todas as Lojas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  <span>Matriz Anual Consolidada de Benefícios {year}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Previsão e histórico mês a mês de gastos em benefícios para todas as 12 lojas da rede.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 text-[11px] font-bold uppercase sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[180px]">LOJA</TableHead>
                        {MONTHS.map((mName, i) => (
                          <TableHead key={i} className="text-right min-w-[90px]">
                            {mName.slice(0, 3).toUpperCase()}
                          </TableHead>
                        ))}
                        <TableHead className="text-right font-black text-primary min-w-[110px]">
                          TOTAL ANUAL
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_SYSTEM_STORES.map((st) => {
                        const data = consolidatedMatrix[st.name] ?? { monthlyTotals: Array(12).fill(0), annualTotal: 0 };
                        return (
                          <TableRow
                            key={st.name}
                            className="text-xs hover:bg-muted/20 cursor-pointer"
                            onClick={() => {
                              setSelectedStore(st.name);
                              setActiveTab("lancamentos");
                            }}
                          >
                            <TableCell className="font-semibold">{st.name}</TableCell>
                            {data.monthlyTotals.map((val, mIdx) => (
                              <TableCell key={mIdx} className="text-right text-[11px]">
                                {val > 0 ? brl(val) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-black text-primary text-xs">
                              {data.annualTotal > 0 ? brl(data.annualTotal) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Linha de Total Geral */}
                      <TableRow className="bg-muted/70 font-extrabold border-t-2 text-xs">
                        <TableCell className="font-extrabold uppercase">TOTAL CONSOLIDADO</TableCell>
                        {grandMonthlyTotals.totals.map((mTot, i) => (
                          <TableCell key={i} className="text-right font-extrabold text-[11px]">
                            {mTot > 0 ? brl(mTot) : "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-black text-primary text-sm">
                          {grandMonthlyTotals.grandAnnual > 0 ? brl(grandMonthlyTotals.grandAnnual) : "—"}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: PARÂMETROS & REGRAS (EXCLUSIVO MASTER)                             */}
          {/* ========================================================================= */}
          {isMaster && (
            <TabsContent value="parametros" className="space-y-4">
              <MasterParametersEditor
                parameters={parameters}
                onSave={(newParams) => {
                  saveParamsMutation.mutate(newParams);
                }}
                isSaving={saveParamsMutation.isPending}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Modal de Edição / Cadastro de Colaborador */}
        {editingEntry && (
          <CollaboratorEditDialog
            entry={editingEntry}
            isNew={isNewEntry}
            isMaster={isMaster}
            parameters={parameters}
            onClose={() => setEditingEntry(null)}
            onSave={(updated) => saveEntryMutation.mutate(updated)}
            isSaving={saveEntryMutation.isPending}
          />
        )}

        {/* Confirmação de Exclusão */}
        <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Colaborador</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover este lançamento do mês? Esta ação será registrada na trilha de auditoria.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingId && deleteEntryMutation.mutate(deletingId)}
              >
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmação de Restauração da Base */}
        <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar Dados da Planilha Oficial</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação recarregará todos os dados originais da planilha "BENEFICIOS MENSAL - V1.0 (1).xlsx" para o ano {year}, restaurando valores e colaboradores de todas as abas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-primary-foreground"
                onClick={() => resetMutation.mutate()}
              >
                Restaurar Base
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------------- */
/* MODAL DE EDIÇÃO / CADASTRO DE COLABORADOR COM CÁLCULOS EM TEMPO REAL     */
/* ------------------------------------------------------------------------- */

function CollaboratorEditDialog({
  entry,
  isNew,
  isMaster,
  parameters,
  onClose,
  onSave,
  isSaving,
}: {
  entry: BenefitEntry;
  isNew: boolean;
  isMaster: boolean;
  parameters: BenefitParameter[];
  onClose: () => void;
  onSave: (entry: any) => void;
  isSaving: boolean;
}) {
  const [collaborator, setCollaborator] = useState(entry.collaborator);
  const [diasMes, setDiasMes] = useState(String(entry.diasMes || 30));
  const [folgas, setFolgas] = useState(String(entry.folgas || 5));
  const [valorVr, setValorVr] = useState(String(entry.valorVr || 39.13));
  const [vtDiarista, setVtDiarista] = useState(String(entry.vtDiarista || 0));
  const [vtMensalista, setVtMensalista] = useState(String(entry.vtMensalista || 0));
  const [aditivoVt, setAditivoVt] = useState(String(entry.aditivoVt || 0));
  const [aditivoVr, setAditivoVr] = useState(String(entry.aditivoVr || 0));
  const [obs, setObs] = useState(entry.obs || "");

  // Cálculos automáticos ao vivo
  const calcs = useMemo(() => {
    return computeBenefitCalculations({
      diasMes: Number(diasMes) || 0,
      folgas: Number(folgas) || 0,
      valorVr: Number(valorVr) || 0,
      vtDiarista: Number(vtDiarista) || 0,
      vtMensalista: Number(vtMensalista) || 0,
      aditivoVt: Number(aditivoVt) || 0,
      aditivoVr: Number(aditivoVr) || 0,
    });
  }, [diasMes, folgas, valorVr, vtDiarista, vtMensalista, aditivoVt, aditivoVr]);

  function handleSave() {
    if (!collaborator.trim()) {
      toast.error("Informe o nome do colaborador.");
      return;
    }

    onSave({
      id: isNew ? undefined : entry.id,
      storeName: entry.storeName,
      collaborator: collaborator.trim(),
      year: entry.year,
      month: entry.month,
      diasMes: Number(diasMes) || 0,
      folgas: Number(folgas) || 0,
      valorVr: Number(valorVr) || 0,
      vtDiarista: Number(vtDiarista) || 0,
      vtMensalista: Number(vtMensalista) || 0,
      aditivoVt: Number(aditivoVt) || 0,
      aditivoVr: Number(aditivoVr) || 0,
      obs: obs.trim(),
    });
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Gift className="size-4 text-primary" />
            <span>
              {isNew ? "Adicionar Colaborador" : `Editar Benefícios — ${entry.collaborator}`}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {entry.storeName} · Competência {(MONTHS[(entry.month || 1) - 1] ?? "Mês").toUpperCase()}/{entry.year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Nome do Colaborador */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nome do Colaborador *</Label>
            <Input
              value={collaborator}
              onChange={(e) => setCollaborator(e.target.value)}
              placeholder="Nome completo ou apelido operacional"
              className="h-9 text-xs"
            />
          </div>

          {/* Dias e Folgas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dias do Mês</Label>
              <Input
                type="number"
                value={diasMes}
                onChange={(e) => setDiasMes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Folgas</Label>
              <Input
                type="number"
                value={folgas}
                onChange={(e) => setFolgas(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-primary">Dias Devidos</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted/30 font-bold text-primary">
                {calcs.diasDevidos}
              </div>
            </div>
          </div>

          {/* Vale Refeição (VR) */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="font-bold text-[11px] uppercase tracking-wide text-foreground">Vale Refeição (VR)</p>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-[11px]">VR Diário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorVr}
                  onChange={(e) => setValorVr(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Aditivo VR (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={aditivoVr}
                  onChange={(e) => setAditivoVr(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold">Total VR</Label>
                <div className="h-8 flex items-center px-2 rounded border bg-background font-bold text-xs">
                  {brl(calcs.totalVr)}
                </div>
              </div>
            </div>
          </div>

          {/* Vale Transporte (VT) */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="font-bold text-[11px] uppercase tracking-wide text-foreground">Vale Transporte (VT)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">VT Mensalista (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={vtMensalista}
                  onChange={(e) => setVtMensalista(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">VT Diarista (R$/dia)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={vtDiarista}
                  onChange={(e) => setVtDiarista(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end pt-1">
              <div className="space-y-1">
                <Label className="text-[11px]">Dep. Diário</Label>
                <div className="h-8 flex items-center px-2 rounded border bg-background font-medium text-xs">
                  {brl(calcs.depositoDiario)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Aditivo VT (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={aditivoVt}
                  onChange={(e) => setAditivoVt(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold">Total VT</Label>
                <div className="h-8 flex items-center px-2 rounded border bg-background font-bold text-xs">
                  {brl(calcs.totalVt)}
                </div>
              </div>
            </div>
          </div>

          {/* Destaque do Valor Final a Receber */}
          <div className="rounded-lg border-2 border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/20 p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
                VALOR A RECEBER (TOTAL DOS BENEFÍCIOS)
              </p>
              <p className="text-[10px] text-muted-foreground">Total VR + Total VT</p>
            </div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">
              {brl(calcs.totalBeneficios)}
            </div>
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação / Justificativa</Label>
            <Input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: CORREÇÃO, ATESTADO, 1 FALTA, ETC."
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="font-bold">
            {isSaving ? "Salvando..." : "Salvar Lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* EDITOR DE PARÂMETROS E REGRAS (EXCLUSIVO MASTER)                          */
/* ------------------------------------------------------------------------- */

function MasterParametersEditor({
  parameters,
  onSave,
  isSaving,
}: {
  parameters: BenefitParameter[];
  onSave: (params: BenefitParameter[]) => void;
  isSaving: boolean;
}) {
  const [params, setParams] = useState<BenefitParameter[]>(parameters);

  function updateParamValue(id: string, newVal: number) {
    setParams((prev) => prev.map((p) => (p.id === id ? { ...p, defaultValue: newVal } : p)));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              <span>Configuração Global de Parâmetros de Benefícios (Master)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Valores padrão utilizados pelo sistema para cálculo inicial de Vale Refeição e Vale Transporte por região e loja.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => onSave(params)} disabled={isSaving} className="font-bold text-xs">
            {isSaving ? "Salvando..." : "Salvar Parâmetros"}
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 text-xs uppercase font-bold">
                <TableRow>
                  <TableHead>REGRA / PARÂMETRO</TableHead>
                  <TableHead>REGIÃO / LOJA</TableHead>
                  <TableHead>TIPO</TableHead>
                  <TableHead>SISTEMA TRANSP.</TableHead>
                  <TableHead className="text-right w-[140px]">VALOR PADRÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {params.map((p) => (
                  <TableRow key={p.id} className="text-xs">
                    <TableCell className="font-semibold">{p.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {p.storeName ? p.storeName : `Região ${p.region}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px]", p.benefitType === "VR" ? "bg-amber-600" : "bg-blue-600")}>
                        {p.benefitType} ({p.valueType})
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.transportSystem || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground text-xs">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={p.defaultValue}
                          onChange={(e) => updateParamValue(p.id, Number(e.target.value) || 0)}
                          className="h-7 w-24 text-right text-xs font-bold"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
