import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listPositionsBasic } from "@/lib/rules.functions";
import { AppShell } from "@/components/app-shell";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/remuneracao/mensal/regras")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("is_master");
    if (error || data !== true) throw redirect({ to: "/remuneracao/mensal/painel" });
  },
  head: () => ({ meta: [
    { title: "Regras mensais | PRISMA" },
    { name: "description", content: "Configure regras mensais de remuneração variável por loja e cargo." },
    { property: "og:title", content: "Regras mensais | PRISMA" },
    { property: "og:description", content: "Configure regras mensais de remuneração variável por loja e cargo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RegrasPage,
});

type Version = {
  id: string; name: string; year: number; quarter: number; month: number | null;
  status: "rascunho" | "publicada" | "arquivada"; min_trigger_pct: number;
  alert_pct: number; target_pct: number; store_id: string | null;
};
type Criterion = {
  id: string; code: string | null; name: string; category: string | null;
  description: string | null; metric_type: string; unit: string | null;
  comparator: string | null; target_value: number | null; target_text: string | null;
  weight_pct: number | null; value_brl: number | null; is_eliminatory: boolean;
  eliminatory_action: string | null; is_required: boolean; requires_justification: boolean;
  active: boolean; sort_order: number; position_id: string | null; notes: string | null;
};
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const copyCriteria = (rows: Criterion[]) => rows.map((row) => ({ ...row }));

function RegrasPage() {
  const qc = useQueryClient();
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;
  const [scope, setScope] = useState("global");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9);
  const [versionId, setVersionId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [draftVersion, setDraftVersion] = useState<Version | null>(null);
  const [draftCriteria, setDraftCriteria] = useState<Criterion[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const versions = useQuery({
    queryKey: ["versions-monthly"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bonus_rule_versions")
        .select("id,name,year,quarter,month,status,min_trigger_pct,alert_pct,target_pct,store_id")
        .order("year", { ascending: false }).order("quarter", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Version[];
    },
  });
  const stores = useQuery({
    queryKey: ["rule-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id,name,code").eq("active", true).order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const loadPositions = useServerFn(listPositionsBasic);
  const positions = useQuery({ queryKey: ["positions"], queryFn: () => loadPositions() });
  const allCriteria = useQuery({
    queryKey: ["criteria-version", versionId], enabled: !!versionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("bonus_criteria").select("*").eq("version_id", versionId).order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Criterion[];
    },
  });

  const quarter = Math.floor((month - 1) / 3) + 1;
  const applicable = useMemo(() => (versions.data ?? []).filter((v) =>
    (scope === "global" ? v.store_id === null : v.store_id === scope) &&
    v.year === year && (v.month === month || (v.month === null && v.quarter === quarter))),
  [versions.data, scope, year, month, quarter]);
  const exact = applicable.filter((v) => v.month === month);
  const candidates = exact.length ? exact : applicable.filter((v) => v.month === null);

  useEffect(() => {
    if (!candidates.some((v) => v.id === versionId)) setVersionId(candidates[0]?.id ?? "");
  }, [candidates, versionId]);
  useEffect(() => {
    if (!positionId && positions.data?.length) setPositionId(positions.data[0]?.id ?? "");
  }, [positions.data, positionId]);
  useEffect(() => {
    const version = candidates.find((v) => v.id === versionId) ?? null;
    setDraftVersion(version ? { ...version } : null);
    setDraftCriteria(copyCriteria(allCriteria.data ?? []));
    setDeletedIds([]);
    setDirty(false);
  }, [versionId, allCriteria.data]);

  const storeName = scope === "global" ? "Global (rede)" : stores.data?.find((s) => s.id === scope)?.name ?? "Loja";
  const locked = !isMaster || draftVersion?.status === "arquivada";
  const rows = draftCriteria.filter((c) => c.position_id === positionId);
  const position = positions.data?.find((p) => p.id === positionId) ?? null;
  const weightSum = rows.filter((c) => !c.is_eliminatory).reduce((sum, c) => sum + Number(c.weight_pct ?? 0), 0);
  const valueSum = rows.filter((c) => !c.is_eliminatory).reduce((sum, c) => sum + Number(c.value_brl ?? 0), 0);

  const patchVersion = (patch: Partial<Version>) => {
    setDraftVersion((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
  };
  const patchCriterion = (id: string, patch: Partial<Criterion>) => {
    setDraftCriteria((current) => current.map((c) => c.id === id ? { ...c, ...patch } : c));
    setDirty(true);
  };
  const addCriterion = () => {
    if (!draftVersion || !positionId) return;
    setDraftCriteria((current) => [...current, {
      id: crypto.randomUUID(), code: null, name: "Novo indicador", category: null,
      description: null, metric_type: "percentual", unit: null, comparator: null,
      target_value: null, target_text: null, weight_pct: null, value_brl: null,
      is_eliminatory: false, eliminatory_action: null, is_required: true,
      requires_justification: false, active: true, sort_order: rows.length + 1,
      position_id: positionId, notes: null,
    }]);
    setDirty(true);
  };
  const removeCriterion = (id: string) => {
    setDraftCriteria((current) => current.filter((c) => c.id !== id));
    if (allCriteria.data?.some((c) => c.id === id)) setDeletedIds((current) => [...current, id]);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draftVersion) throw new Error("Selecione uma versão.");
      const { error } = await supabase.rpc("save_bonus_rule_draft", {
        _version_id: draftVersion.id,
        _version_patch: {
          name: draftVersion.name, min_trigger_pct: draftVersion.min_trigger_pct,
          alert_pct: draftVersion.alert_pct, target_pct: draftVersion.target_pct, status: draftVersion.status,
        },
        _criteria: draftCriteria,
        _deleted_ids: deletedIds,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setDirty(false); setDeletedIds([]);
      await qc.invalidateQueries({ queryKey: ["versions-monthly"] });
      await qc.invalidateQueries({ queryKey: ["criteria-version", versionId] });
      toast.success("REGRAS SALVAS COM SUCESSO", { description: `Loja: ${storeName} · Competência: ${String(month).padStart(2, "0")}/${year}` });
    },
    onError: (error: Error) => toast.error("Não foi possível salvar as regras", { description: error.message }),
  });

  const clone = useMutation({
    mutationFn: async () => {
      const source = (versions.data ?? []).find((v) => v.store_id === null && v.year === year && v.month === month && v.status === "publicada")
        ?? (versions.data ?? []).find((v) => v.store_id === null && v.year === year && v.month === null && v.quarter === quarter && v.status === "publicada");
      if (!source) throw new Error("Não existe regra global aplicável para copiar nesta competência.");
      const { data, error } = await supabase.rpc("clone_bonus_rule_month", {
        _source_version_id: source.id, _store_id: scope === "global" ? null : scope, _year: year, _month: month,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["versions-monthly"] });
      setVersionId(id);
      toast.success("Versão mensal criada como rascunho.");
    },
    onError: (error: Error) => toast.error("Não foi possível criar a versão mensal", { description: error.message }),
  });

  return <AppShell title="Motor de regras" description="Regras por loja, ano e mês — históricos vinculados permanecem congelados" actions={
    <div className="flex flex-wrap items-center gap-2">
      <Select value={scope} onValueChange={setScope}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Loja" /></SelectTrigger><SelectContent>
        <SelectItem value="global">Global (rede)</SelectItem>{(stores.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent></Select>
      <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}><SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
      <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>
        {MONTHS.map((name, index) => <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>)}
      </SelectContent></Select>
      {candidates.length > 1 && <Select value={versionId} onValueChange={setVersionId}><SelectTrigger className="w-[260px]"><SelectValue placeholder="Escolha a versão" /></SelectTrigger><SelectContent>
        {candidates.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {v.status}</SelectItem>)}
      </SelectContent></Select>}
      {isMaster && candidates.length === 0 && <Button variant="outline" size="sm" disabled={clone.isPending} onClick={() => clone.mutate()}><Copy className="size-4" /> Criar versão mensal</Button>}
    </div>
  }>
    {dirty && <Alert className="mb-4"><AlertTriangle className="size-4" /><AlertTitle>ALTERAÇÕES NÃO SALVAS</AlertTitle><AlertDescription>As alterações permanecem somente neste rascunho até salvar.</AlertDescription></Alert>}
    {candidates.length === 0 && <Alert variant="destructive" className="mb-4"><AlertTriangle className="size-4" /><AlertTitle>REGRA NÃO CONFIGURADA PARA ESTE PERÍODO</AlertTitle><AlertDescription>Crie uma versão mensal baseada na regra global aplicável antes de publicar.</AlertDescription></Alert>}
    {candidates.length > 1 && <Alert variant="destructive" className="mb-4"><AlertTriangle className="size-4" /><AlertTitle>MÚLTIPLAS VERSÕES VÁLIDAS</AlertTitle><AlertDescription>O Master deve escolher explicitamente a versão a editar; nenhum cálculo escolherá uma delas automaticamente.</AlertDescription></Alert>}

    {draftVersion && <Card className="mb-5"><CardHeader><CardTitle className="text-base">Parâmetros · {storeName} · {MONTHS[month - 1]}/{year}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <NumberField label="Gatilho mínimo (%)" value={draftVersion.min_trigger_pct} disabled={locked} onChange={(v) => patchVersion({ min_trigger_pct: v })} />
      <NumberField label="Faixa de alerta (%)" value={draftVersion.alert_pct} disabled={locked} onChange={(v) => patchVersion({ alert_pct: v })} />
      <NumberField label="Meta cheia (%)" value={draftVersion.target_pct} disabled={locked} onChange={(v) => patchVersion({ target_pct: v })} />
      <div className="space-y-1.5"><Label>Situação</Label><Select value={draftVersion.status} disabled={!isMaster} onValueChange={(v) => patchVersion({ status: v as Version["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="publicada">Publicada</SelectItem><SelectItem value="arquivada">Arquivada</SelectItem></SelectContent></Select></div>
    </CardContent></Card>}

    <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Indicadores por cargo</CardTitle><p className="mt-1 text-xs text-muted-foreground">Pesos: {weightSum.toFixed(2)}% · valores: {brl(valueSum)}{position?.base_value != null ? ` · máximo: ${brl(position.base_value)}` : ""}</p></div><div className="flex flex-wrap items-center gap-2">
      <Select value={positionId} onValueChange={setPositionId}><SelectTrigger className="w-[240px]"><SelectValue placeholder="Cargo" /></SelectTrigger><SelectContent>{(positions.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      {!locked && draftVersion && <Button size="sm" variant="outline" onClick={addCriterion}><Plus className="size-4" /> Indicador</Button>}
      {!locked && draftVersion && <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}><Save className="size-4" /> SALVAR REGRAS</Button>}
    </div></CardHeader><CardContent className="px-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="min-w-[220px]">Indicador</TableHead><TableHead>Categoria</TableHead><TableHead>Meta (texto)</TableHead><TableHead>Peso %</TableHead><TableHead>Valor R$</TableHead><TableHead>Eliminatório</TableHead><TableHead>Ativo</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {rows.map((c) => <TableRow key={c.id}><TableCell><TextField value={c.name} disabled={locked} onChange={(v) => patchCriterion(c.id, { name: v })} /></TableCell><TableCell><TextField value={c.category ?? ""} disabled={locked} onChange={(v) => patchCriterion(c.id, { category: v || null })} /></TableCell><TableCell><TextField value={c.target_text ?? ""} disabled={locked} onChange={(v) => patchCriterion(c.id, { target_text: v || null })} /></TableCell><TableCell><TextField type="number" value={c.weight_pct == null ? "" : String(c.weight_pct)} disabled={locked} onChange={(v) => patchCriterion(c.id, { weight_pct: v === "" ? null : Number(v) })} /></TableCell><TableCell><TextField type="number" value={c.value_brl == null ? "" : String(c.value_brl)} disabled={locked} onChange={(v) => patchCriterion(c.id, { value_brl: v === "" ? null : Number(v) })} /></TableCell><TableCell><Switch checked={c.is_eliminatory} disabled={locked} onCheckedChange={(v) => patchCriterion(c.id, { is_eliminatory: v })} /></TableCell><TableCell><Switch checked={c.active} disabled={locked} onCheckedChange={(v) => patchCriterion(c.id, { active: v })} /></TableCell><TableCell className="text-right">{!locked && <Button variant="ghost" size="sm" onClick={() => removeCriterion(c.id)}><Trash2 className="size-4 text-destructive" /></Button>}</TableCell></TableRow>)}
      {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">Nenhum indicador configurado para este cargo nesta versão.</TableCell></TableRow>}
    </TableBody></Table></div></CardContent></Card>
    {draftVersion && <p className="mt-4 text-xs text-muted-foreground"><Badge variant="outline" className="mr-2">{draftVersion.status}</Badge>{draftVersion.month === null ? `Regra trimestral legada Q${draftVersion.quarter}` : `Regra mensal ${String(draftVersion.month).padStart(2, "0")}/${draftVersion.year}`} · períodos já vinculados não são alterados.</p>}
  </AppShell>;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type="number" step="0.01" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}
function TextField({ value, disabled, onChange, type = "text" }: { value: string; disabled: boolean; onChange: (value: string) => void; type?: string }) {
  return <Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}
