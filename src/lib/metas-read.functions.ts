import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leitura CONSULTIVA do módulo Orçamento de Metas.
 *
 * Qualquer usuário autenticado (Master, Treinador ou Gerente) pode consultar as
 * metas e o faturamento realizado de TODAS as lojas apenas para comparação.
 * É estritamente somente leitura, com colunas projetadas — nenhuma gravação
 * acontece aqui e nenhuma outra área operacional é afetada.
 */

export type ConsultStore = { id: string; name: string; code: string | null; active: boolean };

export type ConsultGoal = {
  id: string;
  store_id: string;
  year: number;
  month: number;
  base_year: number;
  faturamento_base_ano_anterior: number;
  meta_faturamento: number;
  tc_ano_anterior: number;
  meta_tc: number;
  growth_fat_pct: number;
  growth_tc_pct: number;
  version: number;
  stores: { name: string } | null;
};

export type ConsultActual = {
  store_id: string;
  month: number;
  receita_liquida: number | null;
  taxa_servico: number | null;
  revenue_actual: number | null;
  tc_actual: number | null;
};

export const readMetasConsultivo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { year: number }) => ({ year: Number(data.year) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const year = data.year;

    const [storesRes, goalsRes, periodsRes, histRes] = await Promise.all([
      supabaseAdmin.from("stores").select("id,name,code,active").order("name"),
      supabaseAdmin
        .from("store_goals")
        .select(
          "id,store_id,year,month,base_year,faturamento_base_ano_anterior,meta_faturamento,tc_ano_anterior,meta_tc,growth_fat_pct,growth_tc_pct,version",
        )
        .eq("year", year)
        .order("month"),
      supabaseAdmin.from("bonus_periods").select("id,store_id,month,year").eq("year", year),
      supabaseAdmin
        .from("revenue_history")
        .select("store_id,month,receita_vendas,taxa_servico,tc,faturamento_base_meta")
        .eq("year", year),
    ]);

    if (storesRes.error) throw new Error(storesRes.error.message);
    if (goalsRes.error) throw new Error(goalsRes.error.message);

    const stores = (storesRes.data ?? []) as ConsultStore[];
    const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

    const goals: ConsultGoal[] = (goalsRes.data ?? []).map((g) => ({
      ...(g as Omit<ConsultGoal, "stores">),
      stores: { name: storeNameById.get(g.store_id) ?? "" },
    }));

    // Realizado: store_targets vinculado ao período (fonte oficial) e,
    // como complemento, revenue_history do mesmo ano.
    const map = new Map<string, { receita_liquida: number | null; taxa_servico: number | null; revenue_actual: number | null; tc_actual: number | null }>();

    const periods = periodsRes.data ?? [];
    if (periods.length) {
      const periodById = new Map(periods.map((p) => [p.id, p]));
      const targets = await supabaseAdmin
        .from("store_targets")
        .select("period_id,revenue_actual,tc_actual")
        .in(
          "period_id",
          periods.map((p) => p.id),
        );
      for (const t of targets.data ?? []) {
        const p = periodById.get(t.period_id);
        if (!p) continue;
        const rev = t.revenue_actual != null ? Number(t.revenue_actual) : null;
        const tc = t.tc_actual != null ? Number(t.tc_actual) : null;
        if (rev == null && tc == null) continue;
        map.set(`${String(p.store_id).trim()}-${Number(p.month)}`, {
          receita_liquida: null,
          taxa_servico: null,
          revenue_actual: rev,
          tc_actual: tc,
        });
      }
    }

    for (const rh of histRes.data ?? []) {
      const receita = rh.receita_vendas != null ? Number(rh.receita_vendas) : null;
      const taxa = rh.taxa_servico != null ? Number(rh.taxa_servico) : null;
      const rev = rh.faturamento_base_meta != null
        ? Number(rh.faturamento_base_meta)
        : receita != null || taxa != null
          ? Number(receita ?? 0) + Number(taxa ?? 0)
          : null;
      const tc = rh.tc != null && Number(rh.tc) > 0 ? Number(rh.tc) : null;
      if (rev == null && tc == null) continue;
      const key = `${String(rh.store_id).trim()}-${Number(rh.month)}`;
      const existing = map.get(key);
      map.set(key, {
        receita_liquida: receita,
        taxa_servico: taxa,
        revenue_actual: existing?.revenue_actual ?? rev,
        tc_actual: existing?.tc_actual ?? tc,
      });
    }

    const actuals: ConsultActual[] = Array.from(map.entries()).map(([key, val]) => {
      const sep = key.lastIndexOf("-");
      return {
        store_id: key.slice(0, sep),
        month: Number(key.slice(sep + 1)),
        receita_liquida: val.receita_liquida,
        taxa_servico: val.taxa_servico,
        revenue_actual: val.revenue_actual,
        tc_actual: val.tc_actual,
      };
    });

    return { stores, goals, actuals };
  });
