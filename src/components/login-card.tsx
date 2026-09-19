import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginCard() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as { motivo?: string };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (search?.motivo) toast.error(String(search.motivo));
  }, [search?.motivo]);

  async function signIn() {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .maybeSingle();
    navigate({ to: profile?.must_change_password ? "/alterar-senha" : "/dashboard" });
  }

  async function forgotPassword() {
    if (!email.trim()) {
      toast.error("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    setRecovering(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setRecovering(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail de redefinição");
      return;
    }
    toast.success("Se este e-mail tiver acesso, enviaremos o link de redefinição.");
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha no acesso com Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <section className="w-full max-w-[390px] rounded-2xl border border-black/[0.07] bg-white/95 px-7 py-8 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.4)] backdrop-blur sm:px-9 sm:py-10">
      <header className="mb-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-neutral-400">DEX Invest</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[0.14em] text-neutral-900">PRISMA</h1>
        <p className="mt-2 text-sm text-neutral-500">Acesso corporativo</p>
      </header>
      <div>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-neutral-600">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              autoComplete="email"
              className="h-12 rounded-xl border-neutral-200 bg-neutral-50/70 px-4 shadow-none focus-visible:border-neutral-400 focus-visible:ring-neutral-300"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha" className="text-xs font-medium text-neutral-600">Senha</Label>
            <Input
              id="senha"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              autoComplete="current-password"
              className="h-12 rounded-xl border-neutral-200 bg-neutral-50/70 px-4 shadow-none focus-visible:border-neutral-400 focus-visible:ring-neutral-300"
            />
          </div>
          <Button className="h-12 w-full rounded-xl bg-neutral-900 text-sm font-semibold text-white shadow-none hover:bg-neutral-800" disabled={loading} onClick={signIn}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
          <button
            type="button"
            onClick={forgotPassword}
            disabled={recovering}
            className="w-full text-center text-xs text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline"
          >
            {recovering ? "Enviando…" : "Esqueci minha senha"}
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" /> ou <span className="h-px flex-1 bg-neutral-200" />
        </div>
        <Button variant="outline" className="h-11 w-full rounded-xl border-neutral-200 bg-white text-neutral-700 shadow-none hover:bg-neutral-50" onClick={google}>
          Continuar com Google
        </Button>
      </div>
    </section>
  );
}
