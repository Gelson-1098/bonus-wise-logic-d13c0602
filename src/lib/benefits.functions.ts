import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_BENEFIT_PARAMETERS,
  INITIAL_BENEFIT_ENTRIES,
  type BenefitEntry,
  type BenefitParameter,
} from "@/lib/benefits-initial-data";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any;

async function assertMaster(supabase: SupabaseLike) {
  const { data: isMaster } = await supabase.rpc("is_master");
  if (!isMaster) throw new Error("Ação permitida apenas para o perfil Master / Administrador.");
}

export function computeBenefitCalculations(entry: {
  diasMes: number;
  folgas: number;
  valorVr: number;
  vtDiarista: number;
  vtMensalista: number;
  aditivoVt: number;
  aditivoVr: number;
}) {
  const diasDevidos = Math.max(0, Number(entry.diasMes || 0) - Number(entry.folgas || 0));
  const totalVr = Number(((Number(entry.valorVr || 0) * diasDevidos) + Number(entry.aditivoVr || 0)).toFixed(2));
  const depositoDiario = Number((Number(entry.vtDiarista || 0) * diasDevidos).toFixed(2));
  const totalVt = Number((Number(entry.vtMensalista || 0) + depositoDiario + Number(entry.aditivoVt || 0)).toFixed(2));
  const totalBeneficios = Number((totalVr + totalVt).toFixed(2));

  return {
    diasDevidos,
    totalVr,
    depositoDiario,
    totalVt,
    totalBeneficios,
  };
}

const entrySchema = z.object({
  id: z.string().optional(),
  storeName: z.string().min(1),
  collaborator: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  diasMes: z.number().min(0),
  folgas: z.number().min(0),
  valorVr: z.number().min(0),
  vtDiarista: z.number().min(0),
  vtMensalista: z.number().min(0),
  aditivoVt: z.number().default(0),
  aditivoVr: z.number().default(0),
  obs: z.string().default(""),
});

/** Retorna os lançamentos mensais de benefícios */
export const getBenefitEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year?: number; month?: number; storeName?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const year = data.year ?? 2026;

    // Busca do app_settings
    const settingKey = `benefits_data_${year}`;
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    let allEntries: BenefitEntry[] = [];
    if (setting?.value && Array.isArray(setting.value)) {
      allEntries = setting.value as BenefitEntry[];
    } else {
      allEntries = INITIAL_BENEFIT_ENTRIES.filter((e) => e.year === year);
    }

    let filtered = allEntries;
    if (data.month) {
      filtered = filtered.filter((e) => e.month === data.month);
    }
    if (data.storeName && data.storeName !== "TODAS") {
      filtered = filtered.filter(
        (e) => e.storeName.toLowerCase() === data.storeName!.toLowerCase(),
      );
    }

    return filtered;
  });

/** Salva ou atualiza um lançamento individual com recálculo automático */
export const saveBenefitEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => entrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const year = data.year;
    const settingKey = `benefits_data_${year}`;

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    let allEntries: BenefitEntry[] = [];
    if (setting?.value && Array.isArray(setting.value)) {
      allEntries = setting.value as BenefitEntry[];
    } else {
      allEntries = [...INITIAL_BENEFIT_ENTRIES];
    }

    const calcs = computeBenefitCalculations({
      diasMes: data.diasMes,
      folgas: data.folgas,
      valorVr: data.valorVr,
      vtDiarista: data.vtDiarista,
      vtMensalista: data.vtMensalista,
      aditivoVt: data.aditivoVt,
      aditivoVr: data.aditivoVr,
    });

    const entryId =
      data.id ||
      `ben-${data.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${year}-${data.month}-${data.collaborator.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const newRecord: BenefitEntry = {
      id: entryId,
      storeName: data.storeName,
      collaborator: data.collaborator.trim(),
      year: data.year,
      month: data.month,
      diasMes: data.diasMes,
      folgas: data.folgas,
      diasDevidos: calcs.diasDevidos,
      valorVr: data.valorVr,
      totalVr: calcs.totalVr,
      vtDiarista: data.vtDiarista,
      vtMensalista: data.vtMensalista,
      depositoDiario: calcs.depositoDiario,
      totalVt: calcs.totalVt,
      aditivoVt: data.aditivoVt,
      aditivoVr: data.aditivoVr,
      obs: data.obs.trim(),
      totalBeneficios: calcs.totalBeneficios,
    };

    const existingIdx = allEntries.findIndex((e) => e.id === entryId);
    let oldVal = "Novo registro";
    if (existingIdx >= 0) {
      const prev = allEntries[existingIdx];
      oldVal = prev ? `VR: ${prev.totalVr} | VT: ${prev.totalVt} | Total: ${prev.totalBeneficios}` : "";
      allEntries[existingIdx] = newRecord;
    } else {
      allEntries.push(newRecord);
    }

    // Salva no app_settings
    if (setting) {
      await supabase
        .from("app_settings")
        .update({ value: allEntries as any, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("key", settingKey);
    } else {
      await supabase.from("app_settings").insert({
        key: settingKey,
        value: allEntries as any,
        description: `Dados mensais de benefícios do ano ${year}`,
        updated_by: userId,
      });
    }

    // Trilha de auditoria
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: existingIdx >= 0 ? "edicao_beneficio_colaborador" : "criacao_beneficio_colaborador",
      entity: "benefits",
      entity_id: entryId,
      field: `${data.storeName} - Mês ${data.month} - ${data.collaborator}`,
      old_value: oldVal,
      new_value: `VR: ${newRecord.totalVr} | VT: ${newRecord.totalVt} | Total: ${newRecord.totalBeneficios}`,
      description: `Lançamento de benefícios atualizado (${data.collaborator} - ${data.storeName})`,
    });

    return { ok: true, record: newRecord };
  });

/** Remove um lançamento */
export const deleteBenefitEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; year: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const settingKey = `benefits_data_${data.year}`;

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    if (!setting?.value || !Array.isArray(setting.value)) {
      return { ok: true };
    }

    const allEntries = setting.value as BenefitEntry[];
    const target = allEntries.find((e) => e.id === data.id);
    const filtered = allEntries.filter((e) => e.id !== data.id);

    await supabase
      .from("app_settings")
      .update({ value: filtered as any, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("key", settingKey);

    if (target) {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action: "exclusao_beneficio_colaborador",
        entity: "benefits",
        entity_id: data.id,
        field: `${target.storeName} - Mês ${target.month} - ${target.collaborator}`,
        old_value: `Total: ${target.totalBeneficios}`,
        new_value: "Excluído",
        description: `Colaborador ${target.collaborator} removido do mês ${target.month} em ${target.storeName}`,
      });
    }

    return { ok: true };
  });

/** Busca parâmetros gerais de benefícios */
export const getBenefitParameters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "benefit_parameters")
      .maybeSingle();

    if (setting?.value && Array.isArray(setting.value)) {
      return setting.value as BenefitParameter[];
    }
    return DEFAULT_BENEFIT_PARAMETERS;
  });

/** Salva parâmetros de benefícios (exclusivo Master) */
export const saveBenefitParameters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { parameters: BenefitParameter[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "benefit_parameters")
      .maybeSingle();

    if (setting) {
      await supabase
        .from("app_settings")
        .update({ value: data.parameters as any, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("key", "benefit_parameters");
    } else {
      await supabase.from("app_settings").insert({
        key: "benefit_parameters",
        value: data.parameters as any,
        description: "Parâmetros e regras de VR e VT por região e loja",
        updated_by: userId,
      });
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "atualizacao_parametros_beneficios",
      entity: "benefit_parameters",
      description: "Parâmetros de VR e VT alterados pelo Master",
    });

    return { ok: true };
  });

/** Busca status dos períodos (ESTIMADO vs FECHADO) */
export const getBenefitPeriodStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const settingKey = `benefits_period_statuses_${data.year}`;

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    if (setting?.value && typeof setting.value === "object") {
      return setting.value as Record<string, "estimado" | "fechado">;
    }
    return {} as Record<string, "estimado" | "fechado">;
  });

/** Alterna status do período da loja (ESTIMADO vs FECHADO) */
export const toggleBenefitPeriodStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number; month: number; storeName: string; status: "estimado" | "fechado" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const settingKey = `benefits_period_statuses_${data.year}`;

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    const current = (setting?.value && typeof setting.value === "object" ? setting.value : {}) as Record<string, string>;
    const periodKey = `${data.storeName}-${data.month}`;
    current[periodKey] = data.status;

    if (setting) {
      await supabase
        .from("app_settings")
        .update({ value: current as any, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("key", settingKey);
    } else {
      await supabase.from("app_settings").insert({
        key: settingKey,
        value: current as any,
        description: `Status de fechamento dos períodos de benefícios para ${data.year}`,
        updated_by: userId,
      });
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "alteracao_status_periodo_beneficio",
      entity: "benefits_period",
      field: periodKey,
      new_value: data.status,
      description: `Período ${data.month}/${data.year} de ${data.storeName} marcado como ${data.status.toUpperCase()}`,
    });

    return { ok: true, status: data.status };
  });

/** Restaura base original da planilha para o ano */
export const resetBenefitsToSpreadsheetBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMaster(supabase);

    const settingKey = `benefits_data_${data.year}`;

    await supabase.from("app_settings").upsert({
      key: settingKey,
      value: INITIAL_BENEFIT_ENTRIES as any,
      description: `Dados de benefícios restaurados para base inicial da planilha (${data.year})`,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "restauracao_base_beneficios",
      entity: "benefits",
      description: `Base de benefícios do ano ${data.year} restaurada para os dados da planilha oficial`,
    });

    return { ok: true, count: INITIAL_BENEFIT_ENTRIES.length };
  });
