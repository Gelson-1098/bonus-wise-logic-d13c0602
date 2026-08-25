import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/_authenticated/regras")({
  head: () => ({
    meta: [
      { title: "Motor de regras | DEX BONUS" },
      {
        name: "description",
        content:
          "Configure versões trimestrais, gatilhos, pesos e valores dos indicadores de bônus por cargo, sem alterar históricos.",
      },
      { property: "og:title", content: "Motor de regras | DEX BONUS" },
      { property: "og:description", content: "Parametrização das regras de bonificação por cargo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegrasPage,
});

type Version = {
  id: string;
  name: string;
  year: number;
  quarter: number;
  status: "rascunho" | "publicada" | "arquivada";
  min_trigger_pct: number;
  alert_pct: number;
  target_pct: number;
};

type Criterion = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  metric_type: string;
  unit: string | null;
  comparator: string | null;
  target_value: number | null;
  target_text: string | null;
  weight_pct: number | null;
  value_brl: number | null;
  is_eliminatory: boolean;
  requires_justification: boolean;
  active: boolean;
  sort_order: number;
  position_id: string | null;
};

function RegrasPage() {
  const qc = useQueryClient();
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;
  const [versionId, setVersionId] = useState("");
  const [positionId, setPositionId] = useState("");

  const versions = useQuery({
    queryKey: ["versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_rule_versions")
        .select("id,name,year,quarter,status,min_trigger_pct,alert_pct,target_pct")
        .order("year", { ascending: false })
        .order("quarter", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Version[];
    },
  });

  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id,name,base_value,active")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!versionId && versions.data?.length) setVersionId(versions.data[0]!.id);
  }, [versions.data, versionId]);
  useEffect(() => {
    if (!positionId && positions.data?.length) setPositionId(positions.data[0]!.id);
  }, [positions.data, positionId]);

  const version = versions.data?.find((v) => v.id === versionId) ?? null;
  const locked = !isMaster || version?.status === "arquivada";

  const criteria = useQuery({
    queryKey: ["criteria", versionId, positionId],
    enabled: !!versionId && !!positionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_criteria")
        .select("*")
        .eq("version_id", versionId)
        .eq("position_id", positionId)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Criterion[];
    },
  });

  const updateVersion = useMutation({
    mutationFn: async (patch: Partial<Version>) => {
      const { error } = await supabase.from("bonus_rule_versions").update(patch as never).eq("id", versionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Versão atualizada.");
      qc.invalidateQueries({ queryKey: ["versions"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const upsertCriterion = useMutation({
    mutationFn: async (row: Partial<Criterion> & { id?: string }) => {
      if (row.id) {
        const { id, ...patch } = row;
        const { error } = await supabase.from("bonus_criteria").update(patch as never).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("bonus_criteria").insert({
          version_id: versionId,
          position_id: positionId,
          name: row.name ?? "Novo indicador",
          metric_type: row.metric_type ?? "percentual",
          sort_order: (criteria.data?.length ?? 0) + 1,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["criteria"] }),
    onError: (e: Error) => toast.error("Erro ao salvar indicador", { description: e.message }),
  });

  const removeCriterion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bonus_criteria").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Indicador removido.");
      qc.invalidateQueries({ queryKey: ["criteria"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível remover", {
        description: "Indicadores já usados em períodos calculados não podem ser excluídos.",
      }),
  });

  const cloneVersion = useMutation({
    mutationFn: async () => {
      if (!version) throw new Error("Selecione uma versão.");
      const nextQuarter = version.quarter === 4 ? 1 : version.quarter + 1;
      const nextYear = version.quarter === 4 ? version.year + 1 : version.year;
      const { data: created, error } = await supabase
        .from("bonus_rule_versions")
        .insert({
          name: `${nextQuarter}º Trimestre/${nextYear}`,
          year: nextYear,
          quarter: nextQuarter,
          status: "rascunho",
          min_trigger_pct: version.min_trigger_pct,
          alert_pct: version.alert_pct,
          target_pct: version.target_pct,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { data: all } = await supabase.from("bonus_criteria").select("*").eq("version_id", version.id);
      const rows = (all ?? []).map((c) => {
        const { id, created_at, updated_at, version_id, ...rest } = c as Record<string, unknown>;
        return { ...rest, version_id: created.id };
      });
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("bonus_criteria").insert(rows as never);
        if (insErr) throw new Error(insErr.message);
      }
      return created.id;
    },
    onSuccess: (id) => {
      toast.success("Nova versão criada como rascunho.");
      setVersionId(id);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Erro ao duplicar versão", { description: e.message }),
  });

  const position = positions.data?.find((p) => p.id === positionId) ?? null;
  const weightSum = useMemo(
    () => (criteria.data ?? []).filter((c) => !c.is_eliminatory).reduce((s, c) => s + Number(c.weight_pct ?? 0), 0),
    [criteria.data],
  );
  const valueSum = useMemo(
    () => (criteria.data ?? []).filter((c) => !c.is_eliminatory).reduce((s, c) => s + Number(c.value_brl ?? 0), 0),
    [criteria.data],
  );
  const missingTarget = useMemo(
    () =>
      (criteria.data ?? []).filter(
        (c) => c.active && !c.target_text?.trim() && c.target_value === null,
      ),
    [criteria.data],
  );
  const rows = criteria.data ?? [];
  const baseValue = position?.base_value === null || position?.base_value === undefined ? null : Number(position.base_value);
  const checks = useMemo(() => {
    if (rows.length === 0) return [];
    return [
      {
        ok: Math.abs(weightSum - 100) <= 0.01,
        label: "Soma dos pesos = 100%",
        detail: `Atual: ${weightSum.toFixed(2)}%`,
      },
      {
        ok: baseValue !== null && Math.abs(valueSum - baseValue) <= 0.01,
        label: "Soma dos valores = bônus máximo do cargo",
        detail:
          baseValue === null
            ? "Cargo sem valor base configurado"
            : `Atual: ${brl(valueSum)} · máximo: ${brl(baseValue)}`,
      },
      {
        ok: missingTarget.length === 0,
        label: "Todo indicador com regra de atingimento própria",
        detail:
          missingTarget.length === 0
            ? "Todos os indicadores ativos possuem meta definida"
            : `Sem meta: ${missingTarget.map((c) => c.name).join(", ")}`,
      },
      {
        ok: baseValue === null || valueSum <= baseValue + 0.01,
        label: "Teto por cargo respeitado no cálculo",
        detail:
          baseValue === null
            ? "Cargo sem valor base configurado"
            : valueSum <= baseValue + 0.01
              ? `O pagamento nunca excede ${brl(baseValue)}`
              : `Os valores somam ${brl(valueSum)}, acima do teto ${brl(baseValue)} — o cálculo limitará ao teto`,
      },
    ];
  }, [rows.length, weightSum, valueSum, baseValue, missingTarget]);


  return (
    <AppShell
      title="Motor de regras"
      description="Versões trimestrais — alterações não afetam períodos já fechados"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={versionId} onValueChange={setVersionId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Versão" />
            </SelectTrigger>
            <SelectContent>
              {(versions.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} · {v.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isMaster && (
            <Button variant="outline" size="sm" onClick={() => cloneVersion.mutate()}>
              <Copy className="size-4" /> Duplicar para próximo trimestre
            </Button>
          )}
        </div>
      }
    >
      {!isMaster && (
        <Alert className="mb-4">
          <AlertTriangle className="size-4" />
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>Apenas o perfil Master pode alterar as regras de bonificação.</AlertDescription>
        </Alert>
      )}

      {version && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-base">Parâmetros da versão {version.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <NumberField
              label="Gatilho mínimo (%)"
              value={version.min_trigger_pct}
              disabled={locked}
              onCommit={(v) => updateVersion.mutate({ min_trigger_pct: v })}
            />
            <NumberField
              label="Faixa de alerta (%)"
              value={version.alert_pct}
              disabled={locked}
              onCommit={(v) => updateVersion.mutate({ alert_pct: v })}
            />
            <NumberField
              label="Meta cheia (%)"
              value={version.target_pct}
              disabled={locked}
              onCommit={(v) => updateVersion.mutate({ target_pct: v })}
            />
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Select
                value={version.status}
                disabled={!isMaster}
                onValueChange={(v) => updateVersion.mutate({ status: v as Version["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicada">Publicada</SelectItem>
                  <SelectItem value="arquivada">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Indicadores por cargo</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Soma dos pesos: {weightSum.toFixed(2)}% · soma dos valores: {brl(valueSum)}
              {position?.base_value ? ` · valor base do cargo: ${brl(position.base_value)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                {(positions.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!locked && (
              <Button size="sm" onClick={() => upsertCriterion.mutate({})}>
                <Plus className="size-4" /> Indicador
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {checks.length > 0 && (
            <div className="mx-6 mb-4 rounded-lg border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conferência do cargo {position?.name ?? ""}
              </p>
              <ul className="space-y-2">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <span>
                      <span className={c.ok ? "" : "font-medium text-destructive"}>{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {checks.some((c) => !c.ok) && (
                <p className="mt-3 text-xs text-destructive">
                  Ajuste os pontos marcados antes de publicar esta versão.
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Indicador</TableHead>
                  <TableHead className="w-[130px]">Categoria</TableHead>
                  <TableHead className="w-[150px]">Meta (texto)</TableHead>
                  <TableHead className="w-[100px]">Peso %</TableHead>
                  <TableHead className="w-[120px]">Valor R$</TableHead>
                  <TableHead className="w-[110px]">Eliminatório</TableHead>
                  <TableHead className="w-[90px]">Ativo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(criteria.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <TextField
                        value={c.name}
                        disabled={locked}
                        onCommit={(v) => upsertCriterion.mutate({ id: c.id, name: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={c.category ?? ""}
                        disabled={locked}
                        onCommit={(v) => upsertCriterion.mutate({ id: c.id, category: v || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={c.target_text ?? ""}
                        disabled={locked}
                        onCommit={(v) => upsertCriterion.mutate({ id: c.id, target_text: v || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={c.weight_pct === null ? "" : String(c.weight_pct)}
                        disabled={locked}
                        onCommit={(v) =>
                          upsertCriterion.mutate({ id: c.id, weight_pct: v === "" ? null : Number(v) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={c.value_brl === null ? "" : String(c.value_brl)}
                        disabled={locked}
                        onCommit={(v) =>
                          upsertCriterion.mutate({ id: c.id, value_brl: v === "" ? null : Number(v) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.is_eliminatory}
                        disabled={locked}
                        onCheckedChange={(v) => upsertCriterion.mutate({ id: c.id, is_eliminatory: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.active}
                        disabled={locked}
                        onCheckedChange={(v) => upsertCriterion.mutate({ id: c.id, active: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {!locked && (
                        <Button variant="ghost" size="sm" onClick={() => removeCriterion.mutate(c.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(criteria.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Nenhum indicador configurado para este cargo nesta versão.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {version && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-2">
            {version.status}
          </Badge>
          Somente versões publicadas são aplicadas a novos períodos. Períodos fechados mantêm a memória de cálculo
          congelada.
        </p>
      )}
    </AppShell>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => Number(v) !== value && onCommit(Number(v))}
      />
    </div>
  );
}

function TextField({
  value,
  disabled,
  onCommit,
  type = "text",
}: {
  value: string;
  disabled: boolean;
  onCommit: (v: string) => void;
  type?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <Input
      type={type}
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
    />
  );
}
