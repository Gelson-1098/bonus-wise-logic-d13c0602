import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateBonus, type EngineCriterion, type EngineResult } from "@/lib/bonus-engine";

const resultSchema = z.object({
  criterion_id: z.string().uuid(),
  status: z.enum(["atingiu", "nao_atingiu", "nao_aplicavel"]),
  result_value: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
});

const saveSchema = z.object({
  entry_id: z.string().uuid(),
  no_bonus: z.boolean(),
  no_bonus_reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  results: z.array(resultSchema),
});

const EDITABLE = ["aberto", "em_preenchimento", "correcao_solicitada", "em_conferencia", "enviado"];

/** Recalcula e persiste o lançamento com a memória de cálculo congelada. */
export const saveEntryCalculation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: entry, error: entryErr } = await supabase
      .from("employee_period_entries")
      .select(
        "id, period_id, employee_id, store_id, position_id, positions(base_value,name), employees(full_name), bonus_periods(id,status,month,year,version_id,store_id)",
      )
      .eq("id", data.entry_id)
      .maybeSingle();
    if (entryErr) throw new Error(entryErr.message);
    if (!entry) throw new Error("Lançamento não encontrado ou sem permissão de acesso.");

    const period = entry.bonus_periods as unknown as {
      id: string;
      status: string;
      month: number;
      year: number;
      version_id: string | null;
    };
    if (!EDITABLE.includes(period.status))
      throw new Error("Período fechado ou aprovado — não é possível alterar o lançamento.");

    const version = await resolveVersion(supabase, period.version_id, period.year, period.month);
    if (!version) throw new Error("Nenhuma versão de regras publicada para este período.");

    const { data: criteriaRows } = await supabase
      .from("bonus_criteria")
      .select(
        "id, code, name, category, weight_pct, value_brl, is_eliminatory, eliminatory_action, target_text, active",
      )
      .eq("version_id", version.id)
      .eq("position_id", entry.position_id ?? "00000000-0000-0000-0000-000000000000")
      .order("sort_order");

    const { data: target } = await supabase
      .from("store_targets")
      .select("target_calculated, target_adjusted, revenue_actual")
      .eq("period_id", period.id)
      .maybeSingle();

    const { data: goal } = await supabase
      .from("store_goals")
      .select("meta_faturamento")
      .eq("store_id", entry.store_id)
      .eq("year", period.year)
      .eq("month", period.month)
      .maybeSingle();

    const criteria = (criteriaRows ?? []) as unknown as EngineCriterion[];
    const results = data.results as EngineResult[];
    const base = (entry.positions as unknown as { base_value: number | null } | null)?.base_value ?? null;
    const metaValue = target?.target_adjusted ?? goal?.meta_faturamento ?? target?.target_calculated ?? null;


    const output = calculateBonus({
      baseValue: base === null ? null : Number(base),
      minTriggerPct: Number(version.min_trigger_pct),
      alertPct: Number(version.alert_pct),
      targetPct: Number(version.target_pct),
      target: metaValue === null ? null : Number(metaValue),
      revenue: target?.revenue_actual === null || target?.revenue_actual === undefined ? null : Number(target.revenue_actual),
      criteria,
      results,
      noBonus: data.no_bonus,
      noBonusReason: data.no_bonus_reason ?? null,
      versionName: version.name,
    });

    // persiste resultados por critério
    await supabase.from("employee_criterion_results").delete().eq("entry_id", data.entry_id);
    if (data.results.length > 0) {
      const rows = data.results.map((r) => ({
        entry_id: data.entry_id,
        criterion_id: r.criterion_id,
        status: r.status,
        result_value: r.result_value ?? null,
        note: r.note ?? null,
        value_awarded: output.lines.find((l) => l.criterion_id === r.criterion_id)?.awarded ?? 0,
      }));
      const { error } = await supabase.from("employee_criterion_results").insert(rows);
      if (error) throw new Error(error.message);
    }

    const snapshot = {
      version: { id: version.id, name: version.name, min_trigger_pct: version.min_trigger_pct },
      period: { month: period.month, year: period.year },
      target: metaValue,
      revenue: target?.revenue_actual ?? null,
      base_value: base,
      output,
      computed_by: userId,
    };

    const { error: updErr } = await supabase
      .from("employee_period_entries")
      .update({
        base_value: base,
        calculated_value: output.total,
        result_status: output.status,
        no_bonus: data.no_bonus,
        no_bonus_reason: data.no_bonus_reason ?? null,
        notes: data.notes ?? null,
        calc_snapshot: snapshot,
        calculated_at: new Date().toISOString(),
        calculated_by: userId,
      })
      .eq("id", data.entry_id);
    if (updErr) throw new Error(updErr.message);

    if (period.status === "aberto") {
      await supabase.from("bonus_periods").update({ status: "em_preenchimento" }).eq("id", period.id);
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "calculo_lancamento",
      entity: "employee_period_entries",
      entity_id: data.entry_id,
      store_id: entry.store_id,
      period_id: period.id,
      new_value: String(output.total),
      description: `Lançamento recalculado: ${output.statusLabel} — R$ ${output.total.toFixed(2)}`,
    });

    return { ok: true, output };
  });

const transitionSchema = z.object({
  period_id: z.string().uuid(),
  action: z.enum(["enviar", "aprovar", "reprovar", "solicitar_correcao", "fechar", "reabrir", "pagar"]),
  note: z.string().nullable().optional(),
});

export const transitionPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => transitionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMaster } = await supabase.rpc("is_master");

    const { data: period, error } = await supabase
      .from("bonus_periods")
      .select("id, status, store_id, month, year")
      .eq("id", data.period_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!period) throw new Error("Período não encontrado ou sem permissão.");

    const masterOnly = ["aprovar", "reprovar", "solicitar_correcao", "fechar", "reabrir", "pagar"];
    if (masterOnly.includes(data.action) && !isMaster)
      throw new Error("Apenas o Master pode conferir, aprovar ou fechar o período.");
    if (data.action === "reabrir" && !data.note?.trim())
      throw new Error("Informe o motivo da reabertura.");

    const now = new Date().toISOString();
    const patch: PeriodPatch = {};
    switch (data.action) {
      case "enviar": {
        const { data: entries } = await supabase
          .from("employee_period_entries")
          .select("id, result_status, no_bonus, no_bonus_reason")
          .eq("period_id", period.id);
        const pending = (entries ?? []).filter((e) => e.result_status === "pendente");
        const missingReason = (entries ?? []).filter((e) => e.no_bonus && !e.no_bonus_reason?.trim());
        if ((entries ?? []).length === 0) throw new Error("Nenhum funcionário lançado neste período.");
        if (pending.length > 0)
          throw new Error(`${pending.length} funcionário(s) ainda estão pendentes de lançamento.`);
        if (missingReason.length > 0)
          throw new Error(`${missingReason.length} funcionário(s) sem bônus estão sem justificativa.`);
        patch.status = "enviado";
        patch.submitted_at = now;
        patch.submitted_by = userId;
        break;
      }
      case "aprovar":
        patch.status = "aprovado";
        patch.reviewed_at = now;
        patch.reviewed_by = userId;
        patch.review_note = data.note ?? null;
        break;
      case "reprovar":
      case "solicitar_correcao":
        patch.status = "correcao_solicitada";
        patch.reviewed_at = now;
        patch.reviewed_by = userId;
        patch.review_note = data.note ?? null;
        break;
      case "fechar":
        patch.status = "fechado";
        patch.closed_at = now;
        patch.closed_by = userId;
        break;
      case "pagar":
        patch.status = "pago";
        patch.paid_at = now;
        break;
      case "reabrir":
        patch.status = "em_preenchimento";
        patch.reopened_at = now;
        patch.reopened_by = userId;
        patch.reopen_reason = data.note ?? null;
        break;
    }

    const { error: updErr } = await supabase.from("bonus_periods").update(patch as never).eq("id", period.id);
    if (updErr) throw new Error(updErr.message);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: `periodo_${data.action}`,
      entity: "bonus_periods",
      entity_id: period.id,
      store_id: period.store_id,
      period_id: period.id,
      old_value: period.status,
      new_value: String(patch.status),
      description: data.note ?? null,
    });

    return { ok: true, status: patch.status as string };
  });

const openSchema = z.object({
  store_id: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

/** Abre o período da loja e gera os lançamentos dos funcionários ativos. */
export const openPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => openSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const version = await resolveVersion(supabase, null, data.year, data.month);

    const { data: existing } = await supabase
      .from("bonus_periods")
      .select("id, status")
      .eq("store_id", data.store_id)
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();

    let periodId = existing?.id ?? null;
    if (!periodId) {
      const { data: created, error } = await supabase
        .from("bonus_periods")
        .insert({
          store_id: data.store_id,
          year: data.year,
          month: data.month,
          version_id: version?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      periodId = created.id;
      const { data: goal } = await supabase
        .from("store_goals")
        .select("meta_faturamento")
        .eq("store_id", data.store_id)
        .eq("year", data.year)
        .eq("month", data.month)
        .maybeSingle();
      await supabase.from("store_targets").insert({
        period_id: periodId,
        updated_by: userId,
        target_calculated: goal?.meta_faturamento ?? null,
      });
    }


    const { data: employees } = await supabase
      .from("employees")
      .select("id, position_id, positions(base_value)")
      .eq("store_id", data.store_id)
      .eq("active", true);

    const { data: entries } = await supabase
      .from("employee_period_entries")
      .select("employee_id")
      .eq("period_id", periodId);
    const have = new Set((entries ?? []).map((e) => e.employee_id));

    const toInsert = (employees ?? [])
      .filter((e) => !have.has(e.id))
      .map((e) => ({
        period_id: periodId!,
        employee_id: e.id,
        store_id: data.store_id,
        position_id: e.position_id,
        base_value: (e.positions as unknown as { base_value: number | null } | null)?.base_value ?? null,
      }));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("employee_period_entries").insert(toInsert);
      if (error) throw new Error(error.message);
    }

    return { ok: true, period_id: periodId, created_entries: toInsert.length };
  });

type PeriodPatch = {
  status?: string;
  submitted_at?: string;
  submitted_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string | null;
  closed_at?: string;
  closed_by?: string;
  paid_at?: string;
  reopened_at?: string;
  reopened_by?: string;
  reopen_reason?: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any;

async function resolveVersion(
  supabase: SupabaseLike,
  versionId: string | null,
  year: number,
  month: number,
) {
  if (versionId) {
    const { data } = await supabase
      .from("bonus_rule_versions")
      .select("id,name,min_trigger_pct,alert_pct,target_pct")
      .eq("id", versionId)
      .maybeSingle();
    if (data) return data as VersionRow;
  }
  const quarter = Math.floor((month - 1) / 3) + 1;
  const { data: exact } = await supabase
    .from("bonus_rule_versions")
    .select("id,name,min_trigger_pct,alert_pct,target_pct")
    .eq("status", "publicada")
    .eq("year", year)
    .eq("quarter", quarter)
    .maybeSingle();
  if (exact) return exact as VersionRow;
  const { data: latest } = await supabase
    .from("bonus_rule_versions")
    .select("id,name,min_trigger_pct,alert_pct,target_pct")
    .eq("status", "publicada")
    .order("year", { ascending: false })
    .order("quarter", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest as VersionRow) ?? null;
}

type VersionRow = {
  id: string;
  name: string;
  min_trigger_pct: number;
  alert_pct: number;
  target_pct: number;
};
