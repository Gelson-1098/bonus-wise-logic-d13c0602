import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_BENEFIT_PARAMETERS,
  type BenefitEntry,
  type BenefitParameter,
} from "@/lib/benefits-types";
import { findDbStore, resolveStore } from "@/lib/store-registry";

type AuthenticatedContext = {
  supabase: any;
  userId: string;
};

type StoreAccess = {
  id: string;
  name: string;
  isMaster: boolean;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function storeSettingKey(year: number, storeName: string) {
  return `benefits_data_${year}__${normalizeName(storeName).replace(/[^a-z0-9]+/g, "_")}`;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) return message;
  }
  return fallback;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadAccess(context: AuthenticatedContext) {
  const { supabase, userId } = context;
  const [profileResult, rolesResult, linksResult] = await Promise.all([
    supabase.from("profiles").select("active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("user_stores").select("store_id").eq("user_id", userId),
  ]);

  if (profileResult.error) throw new Error("Não foi possível validar o perfil do usuário.");
  if (rolesResult.error) throw new Error("Não foi possível validar o perfil de acesso.");
  if (linksResult.error) throw new Error("Não foi possível validar as lojas autorizadas.");
  if (!profileResult.data || profileResult.data.active === false) {
    throw new Error("Seu acesso está desativado. Procure o administrador.");
  }

  const roles = (rolesResult.data ?? []).map((row: { role: string }) => row.role);
  if (roles.length === 0) throw new Error("Este usuário não possui acesso autorizado ao PRISMA.");

  return {
    isMaster: roles.includes("master"),
    storeIds: new Set((linksResult.data ?? []).map((row: { store_id: string }) => row.store_id)),
  };
}

async function resolveAuthorizedStore(context: AuthenticatedContext, requestedName: string): Promise<StoreAccess> {
  const access = await loadAccess(context);
  const resolution = resolveStore({ name: requestedName });
  if (resolution.status !== "ok" || !resolution.store) {
    throw new Error("Loja não encontrada no cadastro oficial.");
  }

  const admin = await getAdmin();
  const storesResult = await admin.from("stores").select("id,name,code").eq("active", true);
  if (storesResult.error) throw new Error("Não foi possível validar a loja selecionada.");
  const store = findDbStore(resolution.store, storesResult.data ?? []);
  if (!store) throw new Error("Loja não encontrada no cadastro ativo.");
  if (!access.isMaster && !access.storeIds.has(store.id)) {
    throw new Error("Você não possui acesso aos benefícios desta loja.");
  }

  return { id: store.id, name: requestedName.trim(), isMaster: access.isMaster };
}

async function listAuthorizedStores(context: AuthenticatedContext) {
  const access = await loadAccess(context);
  const admin = await getAdmin();
  const storesResult = await admin.from("stores").select("id,name,code").eq("active", true);
  if (storesResult.error) throw new Error("Não foi possível carregar as lojas autorizadas.");

  const stores = storesResult.data ?? [];
  return {
    isMaster: access.isMaster,
    stores: access.isMaster ? stores : stores.filter((store) => access.storeIds.has(store.id)),
  };
}

async function auditBenefit(input: {
  userId: string;
  action: string;
  storeId?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  description: string;
}) {
  const admin = await getAdmin();
  const result = await admin.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    entity: "benefits",
    store_id: input.storeId ?? null,
    field: input.field ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    description: input.description,
  });
  if (result.error) throw new Error("A gravação foi concluída, mas a auditoria não pôde ser registrada.");
}

async function loadSeedEntries(): Promise<BenefitEntry[]> {
  const mod = await import("@/lib/benefits-seed.server");
  return mod.INITIAL_BENEFIT_ENTRIES;
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
  return { diasDevidos, totalVr, depositoDiario, totalVt, totalBeneficios };
}

const scopeSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  storeName: z.string().trim().min(1).optional(),
});

const entrySchema = z.object({
  id: z.string().optional(),
  storeName: z.string().trim().min(1),
  collaborator: z.string().trim().min(1),
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

const parameterSchema = z.object({
  id: z.string(),
  region: z.enum(["SP", "GRU", "ES", "GERAL"]),
  storeName: z.string().optional(),
  benefitType: z.enum(["VR", "VT"]),
  description: z.string(),
  valueType: z.enum(["diario", "mensal", "tabela"]),
  defaultValue: z.number().min(0),
  ruleName: z.string(),
  transportSystem: z.string().optional(),
  active: z.boolean(),
});

/** Retorna apenas lançamentos das lojas autorizadas ao usuário. */
export const getBenefitEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const authorized = await listAuthorizedStores(context);
    if (data.storeName && data.storeName !== "TODAS") {
      await resolveAuthorizedStore(context, data.storeName);
    }

    const authorizedStoreIds = new Set(authorized.stores.map((store) => store.id));
    const admin = await getAdmin();
    const result = await admin
      .from("app_settings")
      .select("key,value")
      .like("key", `benefits_data_${data.year}%`);
    if (result.error) throw new Error("Não foi possível carregar os benefícios.");

    const rows = result.data ?? [];
    const legacyKey = `benefits_data_${data.year}`;
    const legacy = rows.find((row) => row.key === legacyKey);
    const perStore = rows.filter((row) => row.key !== legacyKey);
    const overriddenKeys = new Set(perStore.map((row) => row.key));
    const merged: BenefitEntry[] = [];

    if (Array.isArray(legacy?.value)) {
      for (const entry of legacy.value as unknown as BenefitEntry[]) {
        if (!overriddenKeys.has(storeSettingKey(data.year, entry.storeName))) merged.push(entry);
      }
    }
    for (const row of perStore) {
      if (Array.isArray(row.value)) merged.push(...(row.value as unknown as BenefitEntry[]));
    }

    return merged.filter((entry) => {
      const resolution = resolveStore({ name: entry.storeName });
      const registeredStore = resolution.status === "ok" && resolution.store
        ? findDbStore(resolution.store, authorized.stores)
        : null;
      if (entry.year !== data.year || !registeredStore || !authorizedStoreIds.has(registeredStore.id)) return false;
      if (data.month && entry.month !== data.month) return false;
      if (data.storeName && data.storeName !== "TODAS") {
        return normalizeName(entry.storeName) === normalizeName(data.storeName);
      }
      return true;
    });
  });

/** Salva ou atualiza um lançamento individual com recálculo oficial. */
export const saveBenefitEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => entrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const admin = await getAdmin();
    const settingKey = storeSettingKey(data.year, store.name);
    const readResult = await admin.from("app_settings").select("value").eq("key", settingKey).maybeSingle();
    if (readResult.error) throw new Error("Não foi possível carregar os lançamentos atuais da loja.");

    const entries = Array.isArray(readResult.data?.value)
      ? (readResult.data.value as unknown as BenefitEntry[])
      : [];
    const calcs = computeBenefitCalculations(data);
    const entryId = data.id || crypto.randomUUID();
    const newRecord: BenefitEntry = {
      id: entryId,
      storeName: store.name,
      collaborator: data.collaborator,
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

    const existingIndex = entries.findIndex((entry) => entry.id === entryId);
    const previous = existingIndex >= 0 ? entries[existingIndex] : undefined;
    if (existingIndex >= 0) entries[existingIndex] = newRecord;
    else entries.push(newRecord);

    const writeResult = await admin.from("app_settings").upsert({
      key: settingKey,
      value: entries as any,
      description: `Benefícios ${store.name} - ${data.year}`,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (writeResult.error) {
      throw new Error(errorMessage(writeResult.error, "Não foi possível salvar o lançamento de benefício."));
    }

    await auditBenefit({
      userId: context.userId,
      action: previous ? "edicao_beneficio_colaborador" : "criacao_beneficio_colaborador",
      storeId: store.id,
      field: `${store.name} - Mês ${data.month} - ${data.collaborator}`,
      oldValue: previous ? `VR: ${previous.totalVr} | VT: ${previous.totalVt} | Total: ${previous.totalBeneficios}` : "Novo registro",
      newValue: `VR: ${newRecord.totalVr} | VT: ${newRecord.totalVt} | Total: ${newRecord.totalBeneficios}`,
      description: `Lançamento de benefícios confirmado (${data.collaborator} - ${store.name})`,
    });
    return { ok: true, record: newRecord };
  });

export const deleteBenefitEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1), year: z.number().int().min(2000).max(2100), storeName: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const admin = await getAdmin();
    const settingKey = storeSettingKey(data.year, store.name);
    const readResult = await admin.from("app_settings").select("value").eq("key", settingKey).maybeSingle();
    if (readResult.error) throw new Error("Não foi possível carregar os lançamentos atuais da loja.");
    const entries = Array.isArray(readResult.data?.value)
      ? (readResult.data.value as unknown as BenefitEntry[])
      : [];
    const target = entries.find((entry) => entry.id === data.id);
    if (!target) throw new Error("Lançamento não encontrado nesta loja.");

    const writeResult = await admin.from("app_settings").upsert({
      key: settingKey,
      value: entries.filter((entry) => entry.id !== data.id) as any,
      description: `Benefícios ${store.name} - ${data.year}`,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (writeResult.error) throw new Error("Não foi possível remover o lançamento.");

    await auditBenefit({
      userId: context.userId,
      action: "exclusao_beneficio_colaborador",
      storeId: store.id,
      field: `${store.name} - Mês ${target.month} - ${target.collaborator}`,
      oldValue: `Total: ${target.totalBeneficios}`,
      newValue: "Excluído",
      description: `Colaborador ${target.collaborator} removido do mês ${target.month} em ${store.name}`,
    });
    return { ok: true };
  });

export const getBenefitParameters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await loadAccess(context);
    const admin = await getAdmin();
    const result = await admin.from("app_settings").select("value").eq("key", "benefit_parameters").maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar os parâmetros de benefícios.");
    return Array.isArray(result.data?.value)
      ? (result.data.value as unknown as BenefitParameter[])
      : DEFAULT_BENEFIT_PARAMETERS;
  });

export const saveBenefitParameters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ parameters: z.array(parameterSchema) }).parse(input))
  .handler(async ({ data, context }) => {
    const access = await loadAccess(context);
    if (!access.isMaster) throw new Error("Ação permitida apenas para o perfil Master / Administrador.");
    const admin = await getAdmin();
    const writeResult = await admin.from("app_settings").upsert({
      key: "benefit_parameters",
      value: data.parameters as any,
      description: "Parâmetros e regras de VR e VT por região e loja",
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (writeResult.error) throw new Error("Não foi possível salvar os parâmetros de benefícios.");
    await auditBenefit({
      userId: context.userId,
      action: "atualizacao_parametros_beneficios",
      description: "Parâmetros de VR e VT alterados pelo Master",
    });
    return { ok: true };
  });

export const getBenefitPeriodStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ year: z.number().int().min(2000).max(2100) }).parse(input))
  .handler(async ({ data, context }) => {
    const authorized = await listAuthorizedStores(context);
    const admin = await getAdmin();
    const result = await admin
      .from("app_settings")
      .select("value")
      .eq("key", `benefits_period_statuses_${data.year}`)
      .maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar os status dos períodos.");
    const statuses = result.data?.value && typeof result.data.value === "object" && !Array.isArray(result.data.value)
      ? (result.data.value as Record<string, "estimado" | "fechado">)
      : {};
    if (authorized.isMaster) return statuses;
    const names = authorized.stores.map((store) => `${store.name}-`);
    return Object.fromEntries(Object.entries(statuses).filter(([key]) => names.some((name) => key.startsWith(name))));
  });

export const toggleBenefitPeriodStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    storeName: z.string().trim().min(1),
    status: z.enum(["estimado", "fechado"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const admin = await getAdmin();
    const settingKey = `benefits_period_statuses_${data.year}`;
    const readResult = await admin.from("app_settings").select("value").eq("key", settingKey).maybeSingle();
    if (readResult.error) throw new Error("Não foi possível carregar o status atual do período.");
    const current = readResult.data?.value && typeof readResult.data.value === "object" && !Array.isArray(readResult.data.value)
      ? { ...(readResult.data.value as Record<string, string>) }
      : {};
    const periodKey = `${store.name}-${data.month}`;
    current[periodKey] = data.status;

    const writeResult = await admin.from("app_settings").upsert({
      key: settingKey,
      value: current as any,
      description: `Status de fechamento dos períodos de benefícios para ${data.year}`,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (writeResult.error) throw new Error("Não foi possível alterar o status do período.");
    await auditBenefit({
      userId: context.userId,
      action: "alteracao_status_periodo_beneficio",
      storeId: store.id,
      field: periodKey,
      newValue: data.status,
      description: `Período ${data.month}/${data.year} de ${store.name} marcado como ${data.status.toUpperCase()}`,
    });
    return { ok: true, status: data.status };
  });

export const resetBenefitsToSpreadsheetBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ year: z.number().int().min(2000).max(2100) }).parse(input))
  .handler(async ({ data, context }) => {
    const access = await loadAccess(context);
    if (!access.isMaster) throw new Error("Ação permitida apenas para o perfil Master / Administrador.");
    const admin = await getAdmin();
    const seed = await loadSeedEntries();
    const writeResult = await admin.from("app_settings").upsert({
      key: `benefits_data_${data.year}`,
      value: seed as any,
      description: `Dados de benefícios restaurados para base inicial da planilha (${data.year})`,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (writeResult.error) throw new Error("Não foi possível restaurar a base de benefícios.");
    await auditBenefit({
      userId: context.userId,
      action: "restauracao_base_beneficios",
      description: `Base de benefícios do ano ${data.year} restaurada para os dados da planilha oficial`,
    });
    return { ok: true, count: seed.length };
  });