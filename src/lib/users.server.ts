import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ROLES, type AppRoleValue } from "@/lib/users-schemas";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any;

const DEFAULT_PASSWORD_KEY = "default_user_password";

export type ActorInfo = { userId: string; email: string | null };

/** Garante que o chamador é Master. Usa o client autenticado (RLS como usuário). */
export async function assertMaster(supabase: SupabaseLike): Promise<ActorInfo> {
  const { data: isMaster, error } = await supabase.rpc("is_master");
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (isMaster !== true) throw new Error("Apenas o Master pode administrar acessos.");

  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? "";
  const email = (claims?.claims?.email as string | undefined) ?? null;
  return { userId, email };
}

export async function audit(
  actor: ActorInfo,
  action: string,
  targetId: string | null,
  description: string,
  extra?: { field?: string; old_value?: string | null; new_value?: string | null },
) {
  await supabaseAdmin.from("audit_logs").insert({
    user_id: actor.userId || null,
    user_email: actor.email,
    action,
    entity: "usuario",
    entity_id: targetId,
    description,
    field: extra?.field ?? null,
    old_value: extra?.old_value ?? null,
    new_value: extra?.new_value ?? null,
  });
}

export async function readDefaultPassword(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("get_security_setting" as never, {
    _key: DEFAULT_PASSWORD_KEY,
  } as never);
  if (error) throw new Error("Não foi possível ler a senha padrão configurada.");
  const password = (data as unknown as string | null) ?? "";
  if (!password) {
    throw new Error(
      "Nenhuma senha padrão está configurada. Defina-a em Administração > Configurações > Segurança.",
    );
  }
  return password;
}

export async function writeDefaultPassword(password: string, actor: ActorInfo) {
  const { error } = await supabaseAdmin.rpc("set_security_setting" as never, {
    _key: DEFAULT_PASSWORD_KEY,
    _value: password,
    _by: actor.userId || null,
  } as never);
  if (error) throw new Error("Não foi possível salvar a senha padrão.");
}

export async function defaultPasswordMeta() {
  const { data } = await supabaseAdmin.rpc("get_security_setting_meta" as never, {
    _key: DEFAULT_PASSWORD_KEY,
  } as never);
  const updatedAt = (data as unknown as string | null) ?? null;
  return { configured: !!updatedAt, updated_at: updatedAt };
}

export type ManagedUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  active: boolean;
  role: AppRoleValue | null;
  store_ids: string[];
  last_sign_in_at: string | null;
  created_at: string | null;
};

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const [profiles, roles, stores, authList] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,full_name,email,active,created_at"),
    supabaseAdmin.from("user_roles").select("user_id,role"),
    supabaseAdmin.from("user_stores").select("user_id,store_id"),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const roleBy = new Map<string, AppRoleValue>();
  for (const r of roles.data ?? []) roleBy.set(r.user_id, r.role as AppRoleValue);

  const storesBy = new Map<string, string[]>();
  for (const s of stores.data ?? []) {
    storesBy.set(s.user_id, [...(storesBy.get(s.user_id) ?? []), s.store_id]);
  }

  const lastBy = new Map<string, string | null>();
  for (const u of authList.data?.users ?? []) lastBy.set(u.id, u.last_sign_in_at ?? null);

  return (profiles.data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    active: (p as { active?: boolean }).active ?? true,
    role: roleBy.get(p.id) ?? null,
    store_ids: storesBy.get(p.id) ?? [],
    last_sign_in_at: lastBy.get(p.id) ?? null,
    created_at: p.created_at ?? null,
  }));
}

async function countActiveMasters(exceptUserId?: string) {
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
  const ids = (roles ?? []).map((r) => r.user_id).filter((id) => id !== exceptUserId);
  if (!ids.length) return 0;
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id,active")
    .in("id", ids);
  return (profiles ?? []).filter((p) => (p as { active?: boolean }).active !== false).length;
}

export async function assertNotLastMaster(userId: string) {
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (role?.role !== "master") return;
  const remaining = await countActiveMasters(userId);
  if (remaining < 1) {
    throw new Error("É necessário manter pelo menos um Master ativo na plataforma.");
  }
}

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("password")) {
    return "A senha escolhida não atende aos requisitos mínimos de segurança.";
  }
  if (m.includes("already been registered") || m.includes("already registered")) {
    return "Este e-mail já possui acesso cadastrado.";
  }
  return message;
}

export async function createManagedUser(
  input: { full_name: string; email: string; role: AppRoleValue; store_ids: string[] },
  actor: ActorInfo,
) {
  if (!ROLES.includes(input.role)) throw new Error("Papel inválido.");

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();
  if (existingProfile) throw new Error("Este e-mail já possui acesso cadastrado.");

  const password = await readDefaultPassword();

  const created = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (created.error || !created.data.user) {
    throw new Error(friendlyAuthError(created.error?.message ?? "Falha ao criar o acesso."));
  }

  const userId = created.data.user.id;
  const storeIds = input.role === "master" ? [] : input.store_ids;

  try {
    const profile = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: input.full_name,
      email: input.email,
      active: true,
    });
    if (profile.error) throw new Error(profile.error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const role = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: input.role });
    if (role.error) throw new Error(role.error.message);

    if (storeIds.length) {
      const links = await supabaseAdmin
        .from("user_stores")
        .insert(storeIds.map((store_id) => ({ user_id: userId, store_id })));
      if (links.error) throw new Error(links.error.message);
    }
  } catch (err) {
    await supabaseAdmin.from("user_stores").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(
      `Não foi possível concluir a criação do usuário: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    );
  }

  await audit(actor, "USER_CREATED", userId, `Usuário ${input.email} criado como ${input.role}.`);

  return { user_id: userId, email: input.email, role: input.role, store_ids: storeIds };
}

export async function renameManagedUser(userId: string, fullName: string, actor: ActorInfo) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  if (error) throw new Error("Não foi possível atualizar o usuário.");
  await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName } });
  await audit(actor, "USER_UPDATED", userId, "Nome do usuário atualizado.", {
    field: "full_name",
    new_value: fullName,
  });
}

export async function setManagedUserRole(userId: string, role: AppRoleValue, actor: ActorInfo) {
  if (!ROLES.includes(role)) throw new Error("Papel inválido.");
  const { data: current } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (current?.role === "master" && role !== "master") await assertNotLastMaster(userId);

  if (role !== "master") {
    const { data: links } = await supabaseAdmin
      .from("user_stores")
      .select("store_id")
      .eq("user_id", userId);
    if (!links?.length) {
      throw new Error("Vincule ao menos uma loja antes de definir este papel.");
    }
  }

  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error("Não foi possível alterar o papel.");

  await audit(actor, "USER_ROLE_UPDATED", userId, "Papel do usuário alterado.", {
    field: "role",
    old_value: current?.role ?? null,
    new_value: role,
  });
}

export async function setManagedUserStores(userId: string, storeIds: string[], actor: ActorInfo) {
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (role?.role !== "master" && storeIds.length === 0) {
    throw new Error("Gerentes e treinadores precisam de ao menos uma loja vinculada.");
  }

  const { data: before } = await supabaseAdmin
    .from("user_stores")
    .select("store_id")
    .eq("user_id", userId);

  await supabaseAdmin.from("user_stores").delete().eq("user_id", userId);
  if (storeIds.length) {
    const { error } = await supabaseAdmin
      .from("user_stores")
      .insert(storeIds.map((store_id) => ({ user_id: userId, store_id })));
    if (error) throw new Error("Não foi possível atualizar os vínculos de loja.");
  }

  await audit(actor, "USER_STORES_UPDATED", userId, "Vínculos de loja atualizados.", {
    field: "user_stores",
    old_value: String((before ?? []).length),
    new_value: String(storeIds.length),
  });
}

export async function resetManagedUserPassword(userId: string, actor: ActorInfo) {
  const password = await readDefaultPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(friendlyAuthError(error.message));
  await audit(actor, "USER_PASSWORD_RESET", userId, "Senha redefinida para a senha padrão atual.");
}

const BAN_FOREVER = "876000h";

export async function setManagedUserActive(userId: string, active: boolean, actor: ActorInfo) {
  if (!active) await assertNotLastMaster(userId);

  const { error } = await supabaseAdmin.from("profiles").update({ active }).eq("id", userId);
  if (error) throw new Error("Não foi possível atualizar o status do usuário.");

  const banResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (banResult.error) {
    await supabaseAdmin.from("profiles").update({ active: !active }).eq("id", userId);
    throw new Error("Não foi possível atualizar o acesso no serviço de autenticação.");
  }

  await audit(
    actor,
    active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    userId,
    active ? "Usuário ativado." : "Usuário desativado.",
  );
}

export async function saveDefaultPassword(password: string, actor: ActorInfo) {
  // valida a senha contra as regras reais do serviço de autenticação usando o próprio Master
  const probe = await supabaseAdmin.auth.admin.updateUserById(actor.userId, { password });
  if (probe.error) throw new Error(friendlyAuthError(probe.error.message));
  await writeDefaultPassword(password, actor);
  await audit(actor, "DEFAULT_PASSWORD_UPDATED", actor.userId, "Senha padrão da plataforma atualizada.");
}
