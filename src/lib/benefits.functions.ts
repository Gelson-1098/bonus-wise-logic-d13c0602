import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_BENEFIT_PARAMETERS,
  type BenefitAdjustment,
  type BenefitEntry,
  type BenefitOccurrence,
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
  entityId?: string;
}) {
  const admin = await getAdmin();
  const result = await admin.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    entity: "benefits",
    entity_id: input.entityId ?? null,
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
  occurrenceDays?: number;
}) {
  const diasDevidos = Math.max(0, Number(entry.diasMes || 0) - Number(entry.folgas || 0) - Number(entry.occurrenceDays || 0));
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
  employeeId: z.string().uuid().optional(),
  storeName: z.string().trim().min(1),
  collaborator: z.string().trim().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  folgas: z.number().min(0),
  valorVr: z.number().min(0),
  vtDiarista: z.number().min(0),
  vtMensalista: z.number().min(0),
  aditivoVt: z.number().default(0),
  aditivoVr: z.number().default(0),
  transportMode: z.enum(["onibus_mensal", "combo_mensal", "onibus_diario", "personalizado"]).optional(),
  occurrences: z.array(z.object({
    id: z.string(),
    type: z.enum(["FALTA", "ATESTADO", "BH", "OUTRO"]),
    days: z.number().positive(),
    note: z.string().trim().min(1),
    deductFromDueDays: z.boolean(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
  })).default([]),
  adjustments: z.array(z.object({
    id: z.string(),
    kind: z.enum(["ADITIVO", "DESCONTO"]),
    category: z.enum(["VR", "VT"]),
    value: z.number().positive(),
    description: z.string().trim().min(1),
  })).default([]),
  obs: z.string().default(""),
});

function calendarDays(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function adjustmentTotal(adjustments: BenefitAdjustment[], category: "VR" | "VT", fallback: number) {
  const matching = adjustments.filter((adjustment) => adjustment.category === category);
  if (!matching.length) return fallback;
  return matching.reduce((sum, adjustment) => sum + (adjustment.kind === "DESCONTO" ? -adjustment.value : adjustment.value), 0);
}

async function loadStoreEntries(year: number, storeName: string) {
  const admin = await getAdmin();
  const settingKey = storeSettingKey(year, storeName);
  const result = await admin.from("app_settings").select("value").eq("key", settingKey).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar os lançamentos atuais da loja.");
  return {
    admin,
    settingKey,
    entries: Array.isArray(result.data?.value) ? (result.data.value as unknown as BenefitEntry[]) : [],
  };
}

async function assertPeriodEditable(input: { year: number; month: number; storeName: string; isMaster: boolean }) {
  if (input.isMaster) return;
  const admin = await getAdmin();
  const result = await admin.from("app_settings").select("value").eq("key", `benefits_period_statuses_${input.year}`).maybeSingle();
  if (result.error) throw new Error("Não foi possível validar o fechamento da competência.");
  const statuses = result.data?.value && typeof result.data.value === "object" && !Array.isArray(result.data.value)
    ? result.data.value as Record<string, string>
    : {};
  if (statuses[`${input.storeName}-${input.month}`] === "fechado") {
    throw new Error("Esta competência está fechada e não pode ser alterada.");
  }
}

const employeeScopeSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  storeName: z.string().trim().min(1),
  search: z.string().trim().max(120).default(""),
});

/** Lista funcionários oficiais sem criar cadastros paralelos. */
export const listBenefitEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => employeeScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const loaded = await loadStoreEntries(data.year, store.name);
    const linkedIds = new Set(loaded.entries.filter((entry) => entry.month === data.month).map((entry) => entry.employeeId).filter(Boolean));
    const term = normalizeName(data.search);
    const employeesResult = await loaded.admin
      .from("employees")
      .select("id,full_name,registration,store_id,position_id,positions(name)")
      .eq("active", true)
      .order("full_name")
      .limit(300);
    if (employeesResult.error) throw new Error("Não foi possível carregar os funcionários oficiais.");
    return (employeesResult.data ?? [])
      .map((employee: any) => ({
        id: employee.id as string,
        fullName: employee.full_name as string,
        registration: employee.registration as string | null,
        storeId: employee.store_id as string,
        positionId: employee.position_id as string | null,
        positionName: (employee.positions as { name?: string } | null)?.name ?? "Sem cargo",
        alreadyLinked: linkedIds.has(employee.id),
      }))
      .filter((employee) => !term || normalizeName(`${employee.fullName} ${employee.registration ?? ""}`).includes(term));
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

const exportSchema = z.object({
  startYear: z.number().int().min(2000).max(2100),
  startMonth: z.number().int().min(1).max(12),
  endYear: z.number().int().min(2000).max(2100),
  endMonth: z.number().int().min(1).max(12),
  storeNames: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(["todos", "aprovados", "pendentes", "reprovados"]),
});

async function loadEntriesForYear(context: AuthenticatedContext, year: number) {
  const authorized = await listAuthorizedStores(context);
  const authorizedStoreIds = new Set(authorized.stores.map((store) => store.id));
  const admin = await getAdmin();
  const result = await admin.from("app_settings").select("key,value").like("key", `benefits_data_${year}%`);
  if (result.error) throw new Error("Não foi possível carregar os benefícios para exportação.");
  const rows = result.data ?? [];
  const legacyKey = `benefits_data_${year}`;
  const legacy = rows.find((row) => row.key === legacyKey);
  const perStore = rows.filter((row) => row.key !== legacyKey);
  const overriddenKeys = new Set(perStore.map((row) => row.key));
  const merged: BenefitEntry[] = [];
  if (Array.isArray(legacy?.value)) {
    for (const entry of legacy.value as unknown as BenefitEntry[]) {
      if (!overriddenKeys.has(storeSettingKey(year, entry.storeName))) merged.push(entry);
    }
  }
  for (const row of perStore) if (Array.isArray(row.value)) merged.push(...(row.value as unknown as BenefitEntry[]));
  return {
    entries: merged.filter((entry) => {
      const resolution = resolveStore({ name: entry.storeName });
      const store = resolution.status === "ok" && resolution.store ? findDbStore(resolution.store, authorized.stores) : null;
      return entry.year === year && !!store && authorizedStoreIds.has(store.id);
    }),
    stores: authorized.stores,
  };
}

/** Entrega os valores persistidos e status reais para o arquivo financeiro. */
export const getBenefitExportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => exportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const start = data.startYear * 12 + data.startMonth;
    const end = data.endYear * 12 + data.endMonth;
    if (end < start) throw new Error("O período final deve ser igual ou posterior ao período inicial.");
    if (end - start > 23) throw new Error("Selecione um intervalo de no máximo 24 meses.");

    const requestedStores = new Set(data.storeNames.map(normalizeName));
    const records: Array<BenefitEntry & { storeCode: string; status: "Aprovado" | "Pendente" }> = [];
    for (let year = data.startYear; year <= data.endYear; year += 1) {
      const loaded = await loadEntriesForYear(context, year);
      const admin = await getAdmin();
      const statusResult = await admin.from("app_settings").select("value").eq("key", `benefits_period_statuses_${year}`).maybeSingle();
      if (statusResult.error) throw new Error("Não foi possível validar o status dos benefícios.");
      const statuses = statusResult.data?.value && typeof statusResult.data.value === "object" && !Array.isArray(statusResult.data.value)
        ? statusResult.data.value as Record<string, "estimado" | "fechado">
        : {};

      for (const entry of loaded.entries) {
        const serial = entry.year * 12 + entry.month;
        if (serial < start || serial > end) continue;
        if (requestedStores.size && !requestedStores.has(normalizeName(entry.storeName))) continue;
        const rawStatus = statuses[`${entry.storeName}-${entry.month}`] ?? "estimado";
        const status = rawStatus === "fechado" ? "Aprovado" : "Pendente";
        if (data.status === "aprovados" && status !== "Aprovado") continue;
        if (data.status === "pendentes" && status !== "Pendente") continue;
        if (data.status === "reprovados") continue;
        const resolution = resolveStore({ name: entry.storeName });
        const store = resolution.status === "ok" && resolution.store ? findDbStore(resolution.store, loaded.stores) : null;
        records.push({ ...entry, storeCode: store?.code ?? "", status });
      }
    }
    return records.sort((a, b) => a.year - b.year || a.month - b.month || a.storeName.localeCompare(b.storeName) || a.collaborator.localeCompare(b.collaborator));
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
    await assertPeriodEditable({ year: data.year, month: data.month, storeName: store.name, isMaster: store.isMaster });
    const { admin, settingKey, entries } = await loadStoreEntries(data.year, store.name);
    const employeeQuery = admin.from("employees").select("id,full_name,position_id,positions(name)").eq("active", true);
    const employeeResult = data.employeeId
      ? await employeeQuery.eq("id", data.employeeId).maybeSingle()
      : await employeeQuery.eq("full_name", data.collaborator).limit(2);
    if (employeeResult.error) throw new Error("Não foi possível validar o funcionário oficial.");
    const employee = Array.isArray(employeeResult.data)
      ? employeeResult.data.length === 1 ? employeeResult.data[0] : null
      : employeeResult.data;
    if (!employee) throw new Error("Selecione um funcionário único do cadastro oficial.");
    const duplicate = entries.find((entry) => entry.month === data.month && entry.employeeId === employee.id && entry.id !== data.id);
    if (duplicate) throw new Error("Este funcionário já possui lançamento nesta loja e competência.");
    const now = new Date().toISOString();
    const occurrences: BenefitOccurrence[] = data.occurrences.map((occurrence) => ({
      ...occurrence,
      createdBy: occurrence.createdBy ?? context.userId,
      createdAt: occurrence.createdAt ?? now,
    }));
    const aditivoVr = adjustmentTotal(data.adjustments, "VR", data.aditivoVr);
    const aditivoVt = adjustmentTotal(data.adjustments, "VT", data.aditivoVt);
    const diasMes = calendarDays(data.year, data.month);
    const calcs = computeBenefitCalculations({
      ...data,
      diasMes,
      aditivoVr,
      aditivoVt,
      occurrenceDays: occurrences.filter((occurrence) => occurrence.deductFromDueDays).reduce((sum, occurrence) => sum + occurrence.days, 0),
    });
    const entryId = data.id || crypto.randomUUID();
    const newRecord: BenefitEntry = {
      id: entryId,
      employeeId: employee.id,
      positionId: employee.position_id ?? undefined,
      positionName: (employee.positions as unknown as { name?: string } | null)?.name ?? undefined,
      storeName: store.name,
      collaborator: employee.full_name,
      year: data.year,
      month: data.month,
      diasMes,
      folgas: data.folgas,
      diasDevidos: calcs.diasDevidos,
      valorVr: data.valorVr,
      totalVr: calcs.totalVr,
      vtDiarista: data.vtDiarista,
      vtMensalista: data.vtMensalista,
      depositoDiario: calcs.depositoDiario,
      totalVt: calcs.totalVt,
      aditivoVt,
      aditivoVr,
      transportMode: data.transportMode,
      occurrences,
      adjustments: data.adjustments,
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
      entityId: entryId,
      storeId: store.id,
      field: `${store.name} - Mês ${data.month} - ${data.collaborator}`,
      oldValue: JSON.stringify(previous ?? null),
      newValue: JSON.stringify(newRecord),
      description: `Lançamento de benefícios confirmado (${data.collaborator} - ${store.name})`,
    });
    return { ok: true, record: newRecord };
  });

export const deleteBenefitEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1), year: z.number().int().min(2000).max(2100), storeName: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const { admin, settingKey, entries } = await loadStoreEntries(data.year, store.name);
    const target = entries.find((entry) => entry.id === data.id);
    if (!target) throw new Error("Lançamento não encontrado nesta loja.");
    await assertPeriodEditable({ year: data.year, month: target.month, storeName: store.name, isMaster: store.isMaster });

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
      entityId: target.id,
      storeId: store.id,
      field: `${store.name} - Mês ${target.month} - ${target.collaborator}`,
      oldValue: JSON.stringify(target),
      newValue: JSON.stringify(null),
      description: `Colaborador ${target.collaborator} removido do mês ${target.month} em ${store.name}`,
    });
    return { ok: true };
  });

export const setBenefitZeroed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    id: z.string().min(1), year: z.number().int(), storeName: z.string().trim().min(1),
    zeroed: z.boolean(), justification: z.string().trim().min(3),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const { admin, settingKey, entries } = await loadStoreEntries(data.year, store.name);
    const index = entries.findIndex((entry) => entry.id === data.id);
    if (index < 0) throw new Error("Lançamento não encontrado.");
    const previous = entries[index];
    if (!previous) throw new Error("Lançamento não encontrado.");
    await assertPeriodEditable({ year: data.year, month: previous.month, storeName: store.name, isMaster: store.isMaster });
    const original = previous.originalCalculation ?? {
      diasDevidos: previous.diasDevidos, totalVr: previous.totalVr, depositoDiario: previous.depositoDiario,
      totalVt: previous.totalVt, totalBeneficios: previous.totalBeneficios,
    };
    const updated: BenefitEntry = data.zeroed
      ? { ...previous, zeroed: true, zeroedReason: data.justification, zeroedAt: new Date().toISOString(), zeroedBy: context.userId, originalCalculation: original, totalVr: 0, depositoDiario: 0, totalVt: 0, totalBeneficios: 0 }
      : { ...previous, zeroed: false, zeroedReason: data.justification, zeroedAt: undefined, zeroedBy: undefined, originalCalculation: undefined, ...original };
    entries[index] = updated;
    const write = await admin.from("app_settings").upsert({ key: settingKey, value: entries as any, description: `Benefícios ${store.name} - ${data.year}`, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (write.error) throw new Error("Não foi possível alterar o benefício.");
    await auditBenefit({ userId: context.userId, action: data.zeroed ? "zeramento_beneficio" : "reativacao_beneficio", entityId: previous.id, storeId: store.id, field: `${store.name} - Mês ${previous.month} - ${previous.collaborator}`, oldValue: JSON.stringify(previous), newValue: JSON.stringify(updated), description: `${data.zeroed ? "Benefício zerado" : "Benefício reativado"}: ${data.justification}` });
    return { ok: true, record: updated };
  });

export const undoLastBenefitChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ year: z.number().int(), storeName: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const store = await resolveAuthorizedStore(context, data.storeName);
    const { admin, settingKey, entries } = await loadStoreEntries(data.year, store.name);
    const logsResult = await admin.from("audit_logs").select("id,action,entity_id,old_value,new_value,field").eq("entity", "benefits").eq("store_id", store.id).eq("user_id", context.userId).in("action", ["criacao_beneficio_colaborador", "edicao_beneficio_colaborador", "exclusao_beneficio_colaborador", "zeramento_beneficio", "reativacao_beneficio", "desfazer_beneficio"]).order("created_at", { ascending: false }).limit(40);
    if (logsResult.error) throw new Error("Não foi possível consultar a última alteração.");
    const undone = new Set((logsResult.data ?? []).filter((row) => row.action === "desfazer_beneficio").map((row) => row.field));
    const target = (logsResult.data ?? []).find((row) => row.action !== "desfazer_beneficio" && !undone.has(row.id));
    if (!target?.entity_id || target.old_value == null) throw new Error("Não há alteração disponível para desfazer.");
    let oldRecord: BenefitEntry | null;
    try { oldRecord = JSON.parse(target.old_value) as BenefitEntry | null; } catch { throw new Error("A última alteração não possui estado restaurável."); }
    const currentIndex = entries.findIndex((entry) => entry.id === target.entity_id);
    const currentRecord = currentIndex >= 0 ? entries[currentIndex] : null;
    const month = oldRecord?.month ?? currentRecord?.month;
    if (!month) throw new Error("Não foi possível identificar a competência da alteração.");
    await assertPeriodEditable({ year: data.year, month, storeName: store.name, isMaster: store.isMaster });
    if (oldRecord) {
      if (currentIndex >= 0) entries[currentIndex] = oldRecord;
      else entries.push(oldRecord);
    } else if (currentIndex >= 0) entries.splice(currentIndex, 1);
    const write = await admin.from("app_settings").upsert({ key: settingKey, value: entries as any, description: `Benefícios ${store.name} - ${data.year}`, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (write.error) throw new Error("Não foi possível desfazer a alteração.");
    await auditBenefit({ userId: context.userId, action: "desfazer_beneficio", entityId: target.entity_id, storeId: store.id, field: target.id, oldValue: JSON.stringify(currentRecord), newValue: JSON.stringify(oldRecord), description: "Última alteração de benefício desfeita" });
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
    if (!store.isMaster) throw new Error("Apenas o perfil Master pode fechar ou reabrir competências.");
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