import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Calculator, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openPeriod, saveEntryCalculation, transitionPeriod } from "@/lib/bonus.functions";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker } from "@/components/period-picker";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  brl,
  pct,
  periodLabel,
  PERIOD_STATUS_LABEL,
  RESULT_STATUS_LABEL,
  resultTone,
  statusTone,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CriterionStatus } from "@/lib/bonus-engine";

export const Route = createFileRoute("/_authenticated/lancamento")({
  head: () => ({
    meta: [
      { title: "Lançamento de resultados | DEX BONUS" },
      {
        name: "description",
        content:
          "Lance metas, faturamento e indicadores de cada colaborador para o cálculo automático do bônus mensal.",
      },
      { property: "og:title", content: "Lançamento de resultados | DEX BONUS" },
      { property: "og:description", content: "Preenchimento mensal de indicadores por loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LancamentoPage,
});

const EDITABLE = ["aberto", "em_preenchimento", "correcao_solicitada"];

function LancamentoPage() {
  const now = new Date();
  const qc = useQueryClient();
  const { data: access } = useAccess();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [storeId, setStoreId] = useState<string>("");
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  const open = useServerFn(openPeriod);
  const transition = useServerFn(transitionPeriod);

  const { data: stores } = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id,name")
        .eq("active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    if (!storeId && stores && stores.length > 0) setStoreId(stores[0]!.id);
  }, [stores, storeId]);

  const periodQuery = useQuery({
    queryKey: ["period", storeId, period.month, period.year],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_periods")
        .select(
          "id,status,month,year,review_note,version_id,bonus_rule_versions(name,min_trigger_pct,alert_pct,target_pct),store_targets(id,base_history,growth_pct,target_calculated,target_adjusted,revenue_actual,tc_actual,manager_note,notes)",
        )
        .eq("store_id", storeId)
        .eq("month", period.month)
        .eq("year", period.year)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const periodId = periodQuery.data?.id ?? null;
  const status = periodQuery.data?.status ?? null;
  const editable = !!status && EDITABLE.includes(status);

  const entriesQuery = useQuery({
    queryKey: ["entries", periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_period_entries")
        .select(
          "id,calculated_value,approved_value,result_status,no_bonus,no_bonus_reason,notes,position_id,employees(full_name),positions(name,base_value)",
        )
        .eq("period_id", periodId!);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const goalQuery = useQuery({
    queryKey: ["goal", storeId, period.month, period.year],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_goals")
        .select("meta_faturamento,meta_tc,growth_fat_pct,growth_tc_pct,base_year")
        .eq("store_id", storeId)
        .eq("year", period.year)
        .eq("month", period.month)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const target = (periodQuery.data?.store_targets ?? null) as {
    id: string;
    base_history: number | null;
    growth_pct: number | null;
    target_calculated: number | null;
    target_adjusted: number | null;
    revenue_actual: number | null;
    tc_actual: number | null;
    manager_note: string | null;
  } | null;
  const version = periodQuery.data?.bonus_rule_versions as
    | { name: string; min_trigger_pct: number; alert_pct: number; target_pct: number }
    | null;
  const goalMeta = goalQuery.data?.meta_faturamento ?? null;
  const metaValue = target?.target_adjusted ?? goalMeta ?? target?.target_calculated ?? null;
  const attainment =
    metaValue && Number(metaValue) > 0 && target?.revenue_actual !== null && target?.revenue_actual !== undefined
      ? (Number(target.revenue_actual) / Number(metaValue)) * 100
      : null;


  const openMutation = useMutation({
    mutationFn: async () => open({ data: { store_id: storeId, year: period.year, month: period.month } }),
    onSuccess: (r) => {
      toast.success("Período aberto", { description: `${r.created_entries} colaborador(es) carregados.` });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Não foi possível abrir o período", { description: e.message }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => transition({ data: { period_id: periodId!, action: "enviar" } }),
    onSuccess: () => {
      toast.success("Período enviado para conferência do Master.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Envio bloqueado", { description: e.message }),
  });

  const totals = (entriesQuery.data ?? []).reduce(
    (s, e) => s + Number(e.approved_value ?? e.calculated_value ?? 0),
    0,
  );

  return (
    <AppShell
      title="Lançamento de resultados"
      description={`${periodLabel(period.month, period.year)} — preencha metas e indicadores`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione a loja" />
            </SelectTrigger>
            <SelectContent>
              {(stores ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PeriodPicker month={period.month} year={period.year} onChange={setPeriod} />
        </div>
      }
    >
      {!periodId ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <p className="text-sm text-muted-foreground">
              Nenhum período aberto para esta loja em {periodLabel(period.month, period.year)}.
            </p>
            <Button disabled={!storeId || openMutation.isPending} onClick={() => openMutation.mutate()}>
              Abrir período e carregar colaboradores
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn(statusTone(status!))}>
              {PERIOD_STATUS_LABEL[status!] ?? status}
            </Badge>
            {version && (
              <span className="text-xs text-muted-foreground">
                Regras vigentes: {version.name} · gatilho {version.min_trigger_pct}%
              </span>
            )}
            <span className="ml-auto text-sm">
              Total do período: <strong>{brl(totals)}</strong>
            </span>
            {editable && (
              <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                <Send className="size-4" /> Enviar para conferência
              </Button>
            )}
          </div>

          {status === "correcao_solicitada" && periodQuery.data?.review_note && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Correção solicitada pelo Master</AlertTitle>
              <AlertDescription>{periodQuery.data.review_note}</AlertDescription>
            </Alert>
          )}

          <TargetCard
            targetId={target?.id ?? null}
            periodId={periodId}
            editable={editable}
            isMaster={access?.isMaster ?? false}
            attainment={attainment}
            minTrigger={version?.min_trigger_pct ?? 90}
            goalMeta={goalMeta === null || goalMeta === undefined ? null : Number(goalMeta)}
            goalTc={goalQuery.data?.meta_tc === undefined ? null : Number(goalQuery.data?.meta_tc)}
            note={target?.manager_note ?? null}
            values={{
              target_adjusted: target?.target_adjusted ?? null,
              revenue_actual: target?.revenue_actual ?? null,
              tc_actual: target?.tc_actual ?? null,
            }}
          />


          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Colaboradores</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMutation.mutate()}
                disabled={!editable || openMutation.isPending}
              >
                Sincronizar colaboradores ativos
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Valor base</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead className="text-right">Bônus calculado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(entriesQuery.data ?? []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {(e.employees as { full_name: string } | null)?.full_name ?? "—"}
                        </TableCell>
                        <TableCell>{(e.positions as { name: string } | null)?.name ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {brl((e.positions as { base_value: number | null } | null)?.base_value ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(resultTone(e.result_status))}>
                            {RESULT_STATUS_LABEL[e.result_status] ?? e.result_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {brl(e.approved_value ?? e.calculated_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setOpenEntry(e.id)}>
                            <Calculator className="size-4" /> Lançar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(entriesQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground">
                          Nenhum colaborador vinculado. Verifique os cadastros da loja.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {openEntry && (
        <EntryDialog
          entryId={openEntry}
          editable={editable || (access?.isMaster ?? false)}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </AppShell>
  );
}

function TargetCard({
  targetId,
  periodId,
  editable,
  isMaster,
  attainment,
  minTrigger,
  goalMeta,
  goalTc,
  note,
  values,
}: {
  targetId: string | null;
  periodId: string;
  editable: boolean;
  isMaster: boolean;
  attainment: number | null;
  minTrigger: number;
  goalMeta: number | null;
  goalTc: number | null;
  note: string | null;
  values: Record<string, number | null>;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(values);
  const [noteText, setNoteText] = useState(note ?? "");
  useEffect(() => setForm(values), [targetId, JSON.stringify(values)]);
  useEffect(() => setNoteText(note ?? ""), [targetId, note]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        target_calculated: goalMeta,
        target_adjusted: isMaster ? (form['target_adjusted'] ?? null) : (values['target_adjusted'] ?? null),
        revenue_actual: form['revenue_actual'] ?? null,
        tc_actual: form['tc_actual'] ?? null,
        manager_note: noteText.trim() === "" ? null : noteText.trim(),
      };
      const { error } = targetId
        ? await supabase.from("store_targets").update(payload).eq("id", targetId)
        : await supabase.from("store_targets").insert({ period_id: periodId, ...payload });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Realizado e observação atualizados.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const tcPct =
    goalTc && goalTc > 0 && form['tc_actual'] !== null && form['tc_actual'] !== undefined
      ? (Number(form['tc_actual']) / goalTc) * 100
      : null;

  const field = (key: string, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step="0.01"
        disabled={!editable}
        value={form[key] ?? ""}
        onChange={(e) =>
          setForm((f) => ({ ...f, [key]: e.target.value === "" ? null : Number(e.target.value) }))
        }
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta da loja e realizado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Meta de faturamento</Label>
            <p className="text-lg font-semibold">{goalMeta === null ? "—" : brl(goalMeta)}</p>
            <p className="text-xs text-muted-foreground">Definida pelo administrador</p>
          </div>
          <div className="space-y-1.5">
            <Label>Meta de TC</Label>
            <p className="text-lg font-semibold">
              {goalTc === null ? "—" : Number(goalTc).toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">Total de clientes atendidos</p>
          </div>
          {field("revenue_actual", "Faturamento realizado (R$)")}
          {field("tc_actual", "TC realizado")}
        </div>

        {isMaster && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {field("target_adjusted", "Meta ajustada (R$)", "Somente o Master — prevalece sobre a meta gerada")}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="manager_note">Observações da loja</Label>
          <Textarea
            id="manager_note"
            rows={3}
            disabled={!editable}
            placeholder="Registre esclarecimentos sobre o período (obras, feriados, falta de equipe...)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "text-sm font-medium",
              attainment !== null && attainment < minTrigger ? "text-destructive" : "text-success",
            )}
          >
            Atingimento do faturamento: {pct(attainment)} (gatilho {minTrigger}%)
          </span>
          <span className="text-sm text-muted-foreground">
            TC: {tcPct === null ? "—" : `${tcPct.toFixed(1)}%`} da meta
          </span>
          {editable && (
            <Button size="sm" className="ml-auto" onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


type CriterionRow = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  weight_pct: number | null;
  value_brl: number | null;
  is_eliminatory: boolean;
  metric_type: string;
  unit: string | null;
  comparator: string | null;
  target_value: number | null;
  target_text: string | null;
  requires_justification: boolean;
};

function EntryDialog({
  entryId,
  editable,
  onClose,
}: {
  entryId: string;
  editable: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveEntryCalculation);
  const [state, setState] = useState<Record<string, { status: CriterionStatus; result_value: number | null; note: string }>>({});
  const [noBonus, setNoBonus] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["entry-detail", entryId],
    queryFn: async () => {
      const { data: entry, error } = await supabase
        .from("employee_period_entries")
        .select(
          "id,position_id,no_bonus,no_bonus_reason,notes,calculated_value,result_status,calc_snapshot,employees(full_name),positions(name,base_value),bonus_periods(version_id,month,year)",
        )
        .eq("id", entryId)
        .single();
      if (error) throw new Error(error.message);

      const versionId = (entry.bonus_periods as { version_id: string | null } | null)?.version_id ?? null;
      const { data: criteria } = await supabase
        .from("bonus_criteria")
        .select(
          "id,code,name,category,weight_pct,value_brl,is_eliminatory,metric_type,unit,comparator,target_value,target_text,requires_justification",
        )
        .eq("version_id", versionId ?? "00000000-0000-0000-0000-000000000000")
        .eq("position_id", entry.position_id ?? "00000000-0000-0000-0000-000000000000")
        .eq("active", true)
        .order("sort_order");

      const { data: results } = await supabase
        .from("employee_criterion_results")
        .select("criterion_id,status,result_value,note")
        .eq("entry_id", entryId);

      return { entry, criteria: (criteria ?? []) as CriterionRow[], results: results ?? [] };
    },
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, { status: CriterionStatus; result_value: number | null; note: string }> = {};
    for (const c of data.criteria) {
      const r = data.results.find((x) => x.criterion_id === c.id);
      next[c.id] = {
        status: (r?.status as CriterionStatus) ?? "nao_aplicavel",
        result_value: r?.result_value === null || r?.result_value === undefined ? null : Number(r.result_value),
        note: r?.note ?? "",
      };
    }
    setState(next);
    setNoBonus(data.entry.no_bonus);
    setReason(data.entry.no_bonus_reason ?? "");
    setNotes(data.entry.notes ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          entry_id: entryId,
          no_bonus: noBonus,
          no_bonus_reason: reason || null,
          notes: notes || null,
          results: Object.entries(state).map(([criterion_id, v]) => ({
            criterion_id,
            status: v.status,
            result_value: v.result_value,
            note: v.note || null,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Cálculo atualizado: ${r.output.statusLabel}`, {
        description: brl(r.output.total),
      });
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const snapshot = (data?.entry.calc_snapshot ?? null) as { output?: { reasons?: string[]; alerts?: string[] } } | null;
  const employee = (data?.entry.employees as { full_name: string } | null)?.full_name ?? "";
  const position = (data?.entry.positions as { name: string } | null)?.name ?? "";
  const criteria = data?.criteria ?? [];
  const scoringSum = useMemo(
    () =>
      criteria
        .filter((c) => !c.is_eliminatory && state[c.id]?.status === "atingiu")
        .reduce((s, c) => s + Number(c.value_brl ?? 0), 0),
    [criteria, state],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee} <span className="font-normal text-muted-foreground">— {position}</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando indicadores…</p>
        ) : criteria.length === 0 ? (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Sem critérios configurados</AlertTitle>
            <AlertDescription>
              O cargo deste colaborador não possui indicadores na versão de regras do período. Configure em
              “Motor de regras”.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicador</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead className="w-[110px]">Resultado</TableHead>
                    <TableHead className="w-[170px]">Situação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.category ?? "—"}
                          {c.is_eliminatory && " · eliminatório"}
                          {c.weight_pct !== null && ` · peso ${Number(c.weight_pct)}%`}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.target_text ??
                          (c.target_value !== null ? `${c.comparator ?? ""} ${c.target_value}${c.unit ?? ""}` : "—")}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!editable}
                          value={state[c.id]?.result_value ?? ""}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              [c.id]: {
                                status: s[c.id]?.status ?? "nao_aplicavel",
                                note: s[c.id]?.note ?? "",
                                result_value: e.target.value === "" ? null : Number(e.target.value),
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={!editable}
                          value={state[c.id]?.status ?? "nao_aplicavel"}
                          onValueChange={(v) =>
                            setState((s) => ({
                              ...s,
                              [c.id]: {
                                result_value: s[c.id]?.result_value ?? null,
                                note: s[c.id]?.note ?? "",
                                status: v as CriterionStatus,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atingiu">Atingiu</SelectItem>
                            <SelectItem value="nao_atingiu">Não atingiu</SelectItem>
                            <SelectItem value="nao_aplicavel">Não lançado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.is_eliminatory ? "—" : brl(c.value_brl)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm">
              Prévia dos indicadores atingidos: <strong>{brl(scoringSum)}</strong>
            </p>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Não receberá bônus neste período</p>
                <p className="text-xs text-muted-foreground">Exige justificativa registrada em auditoria.</p>
              </div>
              <Switch checked={noBonus} onCheckedChange={setNoBonus} disabled={!editable} />
            </div>

            {noBonus && (
              <div className="space-y-1.5">
                <Label htmlFor="reason">Justificativa</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  disabled={!editable}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {snapshot?.output?.reasons && snapshot.output.reasons.length > 0 && (
              <Alert>
                <AlertTitle>Memória do último cálculo</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {snapshot.output.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button disabled={!editable || mutation.isPending} onClick={() => mutation.mutate()}>
                <Calculator className="size-4" /> Calcular e salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
