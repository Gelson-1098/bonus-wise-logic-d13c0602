import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  store_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  receita_vendas: z.number(),
  taxa_servico: z.number(),
  tc: z.number(),
});

const importSchema = z.object({
  base_year: z.number().int().min(2000).max(2100),
  rows: z.array(rowSchema).min(1),
  replace: z.boolean().default(false),
  source_file: z.string().nullable().optional(),
});

const growthSchema = z.object({
  fat_pct: z.number().min(-100).max(1000),
  tc_pct: z.number().min(-100).max(1000),
});

const generateSchema = z.object({
  base_year: z.number().int().min(2000).max(2100),
  target_year: z.number().int().min(2000).max(2100).optional(),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any;

async function assertMaster(supabase: SupabaseLike) {
  const { data: isMaster } = await supabase.rpc("is_master");
  if (!isMaster) throw new Error("Apenas o administrador pode importar faturamento e gerar metas.");
}

async function readGrowth(supabase: SupabaseLike) {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "goal_growth").maybeSingle();
  const value = (data?.value ?? {}) as { fat_pct?: number; tc_pct?: number };
  return { fat_pct: Number(value.fat_pct ?? 10), tc_pct: Number(value.tc_pct ?? 10) };
}

/** Percentual de crescimento configurado (nunca fixo no código). */
export const getGoalGrowth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readGrowth(context.supabase));

export const saveGoalGrowth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => growthSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);
    const before = await readGrowth(supabase);
    const { error } = await supabase
      .from("app_settings")
      .update({ value: { fat_pct: data.fat_pct, tc_pct: data.tc_pct }, updated_by: userId })
      .eq("key", "goal_growth");
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "config_crescimento_meta",
      entity: "app_settings",
      field: "goal_growth",
      old_value: `FAT ${before.fat_pct}% / TC ${before.tc_pct}%`,
      new_value: `FAT ${data.fat_pct}% / TC ${data.tc_pct}%`,
      description: "Percentual de crescimento das metas alterado.",
    });
    return { ok: true, ...data };
  });

/** Grava o histórico do ano base. Sem `replace`, devolve os conflitos sem gravar nada. */
export const importRevenueHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);

    const seen = new Set<string>();
    for (const r of data.rows) {
      const key = `${r.store_id}-${r.month}`;
      if (seen.has(key)) throw new Error("Há linhas duplicadas de loja + mês na planilha.");
      seen.add(key);
      if (r.receita_vendas < 0 || r.taxa_servico < 0 || r.tc < 0)
        throw new Error("Valores negativos encontrados. Corrija a planilha antes de importar.");
    }

    const storeIds = [...new Set(data.rows.map((r) => r.store_id))];
    const { data: existing, error: exErr } = await supabase
      .from("revenue_history")
      .select("id,store_id,month,receita_vendas,taxa_servico,tc")
      .eq("year", data.base_year)
      .in("store_id", storeIds);
    if (exErr) throw new Error(exErr.message);

    const existingMap = new Map(
      (existing ?? []).map((e: { store_id: string; month: number }) => [`${e.store_id}-${e.month}`, e]),
    );
    const conflicts = data.rows.filter((r) => existingMap.has(`${r.store_id}-${r.month}`));

    if (conflicts.length > 0 && !data.replace) {
      return {
        ok: false as const,
        needsConfirmation: true as const,
        conflicts: conflicts.map((c) => ({ store_id: c.store_id, month: c.month })),
        imported: 0,
        goals: 0,
      };
    }

    for (const r of data.rows) {
      const prev = existingMap.get(`${r.store_id}-${r.month}`) as
        | { id: string; receita_vendas: number; taxa_servico: number; tc: number }
        | undefined;
      const payload = {
        store_id: r.store_id,
        year: data.base_year,
        month: r.month,
        receita_vendas: r.receita_vendas,
        taxa_servico: r.taxa_servico,
        tc: r.tc,
        source_file: data.source_file ?? null,
        imported_at: new Date().toISOString(),
        imported_by: userId,
      };
      if (prev) {
        const { error } = await supabase.from("revenue_history").update(payload).eq("id", prev.id);
        if (error) throw new Error(error.message);
        await supabase.from("audit_logs").insert({
          user_id: userId,
          action: "faturamento_substituido",
          entity: "revenue_history",
          entity_id: prev.id,
          store_id: r.store_id,
          field: `${data.base_year}-${String(r.month).padStart(2, "0")}`,
          old_value: `Receita ${prev.receita_vendas} · Taxa ${prev.taxa_servico} · TC ${prev.tc}`,
          new_value: `Receita ${r.receita_vendas} · Taxa ${r.taxa_servico} · TC ${r.tc}`,
          description: "Histórico de faturamento substituído pelo administrador.",
        });
      } else {
        const { error } = await supabase.from("revenue_history").insert(payload);
        if (error) throw new Error(error.message);
      }
    }

    const generated = await generate(supabase, userId, data.base_year, data.base_year + 1, storeIds);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "importacao_faturamento",
      entity: "revenue_history",
      description: `Importação do ano base ${data.base_year}: ${data.rows.length} linha(s), ${generated} meta(s) geradas para ${data.base_year + 1}.`,
    });

    return {
      ok: true as const,
      needsConfirmation: false as const,
      conflicts: [],
      imported: data.rows.length,
      goals: generated,
    };
  });

/** Regera as metas do ano seguinte a partir do histórico e do percentual atual. */
export const generateGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => generateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);
    const targetYear = data.target_year ?? data.base_year + 1;
    const count = await generate(supabase, userId, data.base_year, targetYear, null);
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "geracao_metas",
      entity: "store_goals",
      description: `${count} meta(s) geradas para ${targetYear} com base em ${data.base_year}.`,
    });
    return { ok: true, count, target_year: targetYear };
  });

async function generate(
  supabase: SupabaseLike,
  userId: string,
  baseYear: number,
  targetYear: number,
  storeIds: string[] | null,
) {
  const growth = await readGrowth(supabase);
  let query = supabase
    .from("revenue_history")
    .select("store_id,month,faturamento_base_meta,tc")
    .eq("year", baseYear);
  if (storeIds && storeIds.length > 0) query = query.in("store_id", storeIds);
  const { data: history, error } = await query;
  if (error) throw new Error(error.message);
  if (!history || history.length === 0) return 0;

  const { data: current } = await supabase
    .from("store_goals")
    .select("id,store_id,month,version")
    .eq("year", targetYear);
  const currentMap = new Map(
    (current ?? []).map((g: { store_id: string; month: number }) => [`${g.store_id}-${g.month}`, g]),
  );

  let count = 0;
  for (const h of history as Array<{
    store_id: string;
    month: number;
    faturamento_base_meta: number;
    tc: number;
  }>) {
    const base = Number(h.faturamento_base_meta);
    const tcBase = Number(h.tc);
    const payload = {
      store_id: h.store_id,
      year: targetYear,
      month: h.month,
      base_year: baseYear,
      faturamento_base_ano_anterior: base,
      meta_faturamento: base * (1 + growth.fat_pct / 100),
      tc_ano_anterior: tcBase,
      meta_tc: Math.round(tcBase * (1 + growth.tc_pct / 100)),
      growth_fat_pct: growth.fat_pct,
      growth_tc_pct: growth.tc_pct,
      generated_at: new Date().toISOString(),
      generated_by: userId,
    };
    const prev = currentMap.get(`${h.store_id}-${h.month}`) as
      | { id: string; version: number }
      | undefined;
    if (prev) {
      const { error: upErr } = await supabase
        .from("store_goals")
        .update({ ...payload, version: Number(prev.version) + 1 })
        .eq("id", prev.id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await supabase.from("store_goals").insert(payload);
      if (insErr) throw new Error(insErr.message);
    }
    count += 1;
  }
  return count;
}
