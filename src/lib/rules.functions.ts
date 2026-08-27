import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leituras de dados confidenciais (cargos, valores-base e critérios de bônus).
 * As tabelas ficam restritas ao Master no banco; aqui o acesso é validado com o
 * cliente do usuário (RLS) antes de qualquer leitura privilegiada.
 */

/** Lista de cargos: nome sempre; valor-base apenas para o Master. */
export const listPositionsBasic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: isMaster } = await supabase.rpc("is_master");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("positions")
      .select("id,name,base_value")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      base_value: isMaster === true ? p.base_value : null,
    }));
  });

/** Parâmetros da versão de regras vigente do período (gatilho, alerta, meta). */
export const getPeriodVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ period_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: period, error } = await supabase
      .from("bonus_periods")
      .select("id,version_id")
      .eq("id", data.period_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!period) throw new Error("Período não encontrado ou sem permissão de acesso.");
    if (!period.version_id) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: version } = await supabaseAdmin
      .from("bonus_rule_versions")
      .select("name,min_trigger_pct,alert_pct,target_pct")
      .eq("id", period.version_id)
      .maybeSingle();
    return version ?? null;
  });

/** Critérios aplicáveis a um lançamento, com o nome do cargo do funcionário. */
export const getEntryRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ entry_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entry, error } = await supabase
      .from("employee_period_entries")
      .select("id,position_id,bonus_periods(version_id)")
      .eq("id", data.entry_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!entry) throw new Error("Lançamento não encontrado ou sem permissão de acesso.");

    const versionId = (entry.bonus_periods as unknown as { version_id: string | null } | null)?.version_id ?? null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: position } = entry.position_id
      ? await supabaseAdmin.from("positions").select("name").eq("id", entry.position_id).maybeSingle()
      : { data: null };

    const { data: criteria } = await supabaseAdmin
      .from("bonus_criteria")
      .select(
        "id,code,name,category,weight_pct,value_brl,is_eliminatory,metric_type,unit,comparator,target_value,target_text,requires_justification",
      )
      .eq("version_id", versionId ?? "00000000-0000-0000-0000-000000000000")
      .eq("position_id", entry.position_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("active", true)
      .order("sort_order");

    return {
      position_name: (position as { name: string } | null)?.name ?? "",
      criteria: criteria ?? [],
    };
  });
