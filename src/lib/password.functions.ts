import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const completeRequiredPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw new Error("Não foi possível concluir a troca obrigatória de senha.");
    const { error: clearError } = await supabaseAdmin.rpc("clear_user_temp_password" as never, {
      _user_id: context.userId,
    } as never);
    if (clearError) throw new Error("A senha foi alterada, mas a credencial temporária não pôde ser invalidada.");
    return { ok: true as const };
  });