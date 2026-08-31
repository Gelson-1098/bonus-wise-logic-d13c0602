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

const actualRowSchema = z.object({
  store_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  revenue_actual: z.number().min(0),
  tc_actual: z.number().min(0),
});

const importActualSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  rows: z.array(actualRowSchema).min(1),
  source_file: z.string().nullable().optional(),
});

/** Importa faturamento realizado do ano atual para apuração de atingimento. */
export const importActualRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importActualSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);

    let updatedCount = 0;
    for (const r of data.rows) {
      let { data: period } = await supabase
        .from("bonus_periods")
        .select("id")
        .eq("store_id", r.store_id)
        .eq("month", r.month)
        .eq("year", data.year)
        .maybeSingle();

      if (!period) {
        const { data: newPeriod, error: pErr } = await supabase
          .from("bonus_periods")
          .insert({
            store_id: r.store_id,
            month: r.month,
            year: data.year,
            status: "aberto",
          })
          .select("id")
          .single();
        if (pErr) continue;
        period = newPeriod;
      }

      const { data: target } = await supabase
        .from("store_targets")
        .select("id")
        .eq("period_id", period.id)
        .maybeSingle();

      if (target) {
        await supabase
          .from("store_targets")
          .update({
            revenue_actual: r.revenue_actual,
            tc_actual: r.tc_actual,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.from("store_targets").insert({
          period_id: period.id,
          store_id: r.store_id,
          revenue_actual: r.revenue_actual,
          tc_actual: r.tc_actual,
          target_calculated: 0,
        } as any);
      }
      updatedCount += 1;
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "importacao_realizado",
      entity: "store_targets",
      description: `Importação de faturamento realizado para ${data.year}: ${updatedCount} registros atualizados.`,
    });

    return { ok: true, count: updatedCount };
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

const updateManualSchema = z.object({
  goal_id: z.string().uuid(),
  meta_faturamento: z.number().min(0),
  meta_tc: z.number().min(0),
  reason: z.string().min(3, "Informe uma justificativa para o ajuste manual da meta."),
});

/** Ajuste manual exclusivo do Master com justificativa e trilha de auditoria. */
export const updateStoreGoalManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateManualSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);

    const { data: prev, error: prevErr } = await supabase
      .from("store_goals")
      .select("id, store_id, year, month, meta_faturamento, meta_tc, version, stores(name)")
      .eq("id", data.goal_id)
      .single();
    if (prevErr || !prev) throw new Error("Meta não encontrada.");

    const { error: updErr } = await supabase
      .from("store_goals")
      .update({
        meta_faturamento: data.meta_faturamento,
        meta_tc: data.meta_tc,
        version: Number(prev.version) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.goal_id);
    if (updErr) throw new Error(updErr.message);

    const storeName = (prev.stores as { name?: string } | null)?.name ?? "Loja";
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "ajuste_manual_meta",
      entity: "store_goals",
      entity_id: data.goal_id,
      store_id: prev.store_id,
      field: `Meta ${prev.year}-${String(prev.month).padStart(2, "0")}`,
      old_value: `FAT: R$ ${Number(prev.meta_faturamento).toFixed(2)} | TC: ${Number(prev.meta_tc).toFixed(0)}`,
      new_value: `FAT: R$ ${data.meta_faturamento.toFixed(2)} | TC: ${data.meta_tc.toFixed(0)}`,
      description: `Ajuste manual da meta (${storeName}): ${data.reason.trim()}`,
    });

    return { ok: true, goal_id: data.goal_id };
  });

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Limpa e unifica lojas duplicadas, migrando os registros relacionados para a loja canônica. */
export async function cleanupAndStandardizeStores(supabase: SupabaseLike, userId: string) {
  const { CANONICAL_STORES } = await import("@/lib/official-pdf-data");

  const { data: allStores, error: stErr } = await supabase
    .from("stores")
    .select("id, name, code, active, city, state");
  if (stErr) throw new Error(stErr.message);

  const canonicalStoreMap = new Map<string, string>(); // canonicalKey -> primaryStoreId
  let duplicatesRemoved = 0;
  let storesUpdated = 0;

  for (const canonical of CANONICAL_STORES) {
    const matching = (allStores ?? []).filter((s: { name: string; code: string | null }) => {
      const normName = normalizeText(s.name || "");
      const normCode = normalizeText(s.code || "");
      if (normCode === normalizeText(canonical.code)) return true;
      if (normName === normalizeText(canonical.name)) return true;
      if (normName === canonical.key) return true;
      return canonical.aliases.some((a) => normName.includes(a) || a.includes(normName));
    });

    let primary = matching.find((s: { code: string | null }) => s.code === canonical.code);
    if (!primary && matching.length > 0) {
      primary = matching[0];
    }

    if (primary) {
      // Atualiza os dados da loja principal com o padrão oficial
      await supabase
        .from("stores")
        .update({
          name: canonical.name,
          code: canonical.code,
          city: canonical.city,
          state: canonical.state,
          active: true,
        })
        .eq("id", primary.id);
      storesUpdated += 1;
      canonicalStoreMap.set(canonical.key, primary.id);

      // Limpa duplicatas
      for (const dup of matching) {
        if (dup.id === primary.id) continue;

        // 1. Migra ou remove metas duplicadas
        const { data: dupGoals } = await supabase.from("store_goals").select("id, year, month").eq("store_id", dup.id);
        for (const dg of dupGoals ?? []) {
          const { data: existG } = await supabase
            .from("store_goals")
            .select("id")
            .eq("store_id", primary.id)
            .eq("year", dg.year)
            .eq("month", dg.month)
            .maybeSingle();
          if (existG) {
            await supabase.from("store_goals").delete().eq("id", dg.id);
          } else {
            await supabase.from("store_goals").update({ store_id: primary.id }).eq("id", dg.id);
          }
        }

        // 2. Migra ou remove histórico de faturamento duplicado
        const { data: dupRev } = await supabase.from("revenue_history").select("id, year, month").eq("store_id", dup.id);
        for (const dr of dupRev ?? []) {
          const { data: existR } = await supabase
            .from("revenue_history")
            .select("id")
            .eq("store_id", primary.id)
            .eq("year", dr.year)
            .eq("month", dr.month)
            .maybeSingle();
          if (existR) {
            await supabase.from("revenue_history").delete().eq("id", dr.id);
          } else {
            await supabase.from("revenue_history").update({ store_id: primary.id }).eq("id", dr.id);
          }
        }

        // 3. Migra vínculos de colaboradores
        await supabase.from("employees").update({ store_id: primary.id }).eq("store_id", dup.id);

        // 4. Migra acessos de usuários
        const { data: dupUserStores } = await supabase.from("user_stores").select("user_id").eq("store_id", dup.id);
        for (const us of dupUserStores ?? []) {
          const { data: existUs } = await supabase
            .from("user_stores")
            .select("id")
            .eq("store_id", primary.id)
            .eq("user_id", us.user_id)
            .maybeSingle();
          if (existUs) {
            await supabase.from("user_stores").delete().eq("store_id", dup.id).eq("user_id", us.user_id);
          } else {
            await supabase.from("user_stores").update({ store_id: primary.id }).eq("store_id", dup.id).eq("user_id", us.user_id);
          }
        }

        // 5. Migra períodos e lançamentos
        await supabase.from("bonus_periods").update({ store_id: primary.id }).eq("store_id", dup.id);
        await supabase.from("employee_period_entries").update({ store_id: primary.id }).eq("store_id", dup.id);

        // 6. Exclui a loja duplicada
        await supabase.from("stores").delete().eq("id", dup.id);
        duplicatesRemoved += 1;
      }
    } else {
      // Se não existia nenhuma loja para este padrão, cria nova
      const { data: created, error: cErr } = await supabase
        .from("stores")
        .insert({
          name: canonical.name,
          code: canonical.code,
          city: canonical.city,
          state: canonical.state,
          active: true,
        })
        .select("id")
        .single();
      if (!cErr && created) {
        canonicalStoreMap.set(canonical.key, created.id);
        storesUpdated += 1;
      }
    }
  }

  // Desativa lojas legadas que não pertencem ao catálogo oficial
  const canonicalIds = Array.from(canonicalStoreMap.values());
  if (canonicalIds.length > 0) {
    await supabase.from("stores").update({ active: false }).not("id", "in", `(${canonicalIds.join(",")})`);
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "padronizacao_lojas",
    entity: "stores",
    description: `Padronização e deduplicação de lojas concluída: ${storesUpdated} lojas oficiais ajustadas e ${duplicatesRemoved} duplicidades removidas.`,
  });

  return { canonicalStoreMap, duplicatesRemoved, storesUpdated };
}

/** Endpoint exclusivo do Master para limpar e padronizar lojas. */
export const deduplicateStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);
    return cleanupAndStandardizeStores(supabase, userId);
  });

/** Sincronização oficial dos dados do PDF com padronização e deduplicação automática. */
export const syncOfficialPdfGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);

    const { OFFICIAL_PDF_DATA, CANONICAL_STORES } = await import("@/lib/official-pdf-data");

    // 1. Padroniza e limpa duplicidades em stores
    const { canonicalStoreMap } = await cleanupAndStandardizeStores(supabase, userId);

    // 2. Grava/atualiza os registros de faturamento base do ano anterior (2025)
    for (const item of OFFICIAL_PDF_DATA) {
      const storeId = canonicalStoreMap.get(item.canonicalKey);
      if (!storeId) continue;

      const { data: existRev } = await supabase
        .from("revenue_history")
        .select("id")
        .eq("store_id", storeId)
        .eq("year", item.year)
        .eq("month", item.month)
        .maybeSingle();

      const payload = {
        store_id: storeId,
        year: item.year,
        month: item.month,
        receita_vendas: item.receita_vendas,
        taxa_servico: item.taxa_servico,
        tc: item.tc,
        source_file: "PDF Oficial - Metas 2025/2026",
        imported_at: new Date().toISOString(),
        imported_by: userId,
      };

      if (existRev) {
        await supabase.from("revenue_history").update(payload).eq("id", existRev.id);
      } else {
        await supabase.from("revenue_history").insert(payload);
      }
    }

    // 3. Gera automaticamente as metas para 2026 com base em 2025 (+10%)
    const generated = await generate(supabase, userId, 2025, 2026, null);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "sincronizacao_pdf_oficial",
      entity: "store_goals",
      description: `Carga oficial do PDF concluída: 10 lojas oficiais padronizadas, ${OFFICIAL_PDF_DATA.length} registros de base 2025 e ${generated} metas geradas para 2026 (+10%).`,
    });

    return {
      ok: true,
      storesCount: CANONICAL_STORES.length,
      recordsCount: OFFICIAL_PDF_DATA.length,
      goalsGenerated: generated,
    };
  });
