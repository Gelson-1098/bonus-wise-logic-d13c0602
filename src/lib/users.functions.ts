import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createUserSchema,
  defaultPasswordSchema,
  updateRoleSchema,
  updateStoresSchema,
  updateUserSchema,
  userIdSchema,
} from "@/lib/users-schemas";

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("@/lib/users.server");
    await m.assertMaster(context.supabase);
    return m.listManagedUsers();
  });

export const getDefaultPasswordStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("@/lib/users.server");
    await m.assertMaster(context.supabase);
    return m.defaultPasswordMeta();
  });

export const setDefaultPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => defaultPasswordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.saveDefaultPassword(data.password, actor);
    return { ok: true as const };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    return m.createManagedUser(data, actor);
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.renameManagedUser(data.user_id, data.full_name, actor);
    return { ok: true as const };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.setManagedUserRole(data.user_id, data.role, actor);
    return { ok: true as const };
  });

export const updateUserStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateStoresSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.setManagedUserStores(data.user_id, data.store_ids, actor);
    return { ok: true as const };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.resetManagedUserPassword(data.user_id, actor);
    return { ok: true as const };
  });

export const activateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.setManagedUserActive(data.user_id, true, actor);
    return { ok: true as const };
  });

export const deactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/users.server");
    const actor = await m.assertMaster(context.supabase);
    await m.setManagedUserActive(data.user_id, false, actor);
    return { ok: true as const };
  });
