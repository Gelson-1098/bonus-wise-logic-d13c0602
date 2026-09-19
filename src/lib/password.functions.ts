import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const completeRequiredPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw new Error("Não foi possível concluir a troca obrigatória de senha.");
    return { ok: true as const };
  });