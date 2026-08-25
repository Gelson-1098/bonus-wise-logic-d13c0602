import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRoleValue } from "@/lib/users-schemas";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export type AccessInfo = {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  isMaster: boolean;
  role: AppRoleValue | null;
  active: boolean;
  authorized: boolean;
  storeIds: string[];
};

export function useAccess() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  return useQuery<AccessInfo>({
    queryKey: ["access", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [roles, stores, profile] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId!),
        supabase.from("user_stores").select("store_id").eq("user_id", userId!),
        supabase.from("profiles").select("full_name,email,active").eq("id", userId!).maybeSingle(),
      ]);
      const role = ((roles.data ?? [])[0]?.role ?? null) as AppRoleValue | null;
      const active = (profile.data as { active?: boolean } | null)?.active ?? true;
      return {
        userId,
        email: profile.data?.email ?? session?.user.email ?? null,
        fullName: profile.data?.full_name ?? null,
        isMaster: (roles.data ?? []).some((r) => r.role === "master"),
        role,
        active,
        authorized: !!role && active,
        storeIds: (stores.data ?? []).map((s) => s.store_id),
      };
    },
  });
}

/**
 * Autorização pós-login: quem não tem papel definido pelo Master, ou está
 * inativo, é desconectado imediatamente. Vale para e-mail/senha e Google.
 */
export function useAuthorizationGate() {
  const { data: access, isSuccess } = useAccess();

  useEffect(() => {
    if (!isSuccess || !access || access.authorized) return;
    const message = !access.role
      ? "Este e-mail não possui acesso autorizado ao VÉRTICE."
      : "Seu acesso está desativado. Procure o administrador.";
    void supabase.auth.signOut().then(() => {
      window.location.assign(`/auth?motivo=${encodeURIComponent(message)}`);
    });
  }, [isSuccess, access]);

  return access;
}
