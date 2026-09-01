import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    navigate({ to: "/dashboard" });
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
    <Card className="w-full max-w-sm border-border/60 shadow-xl">
      <CardHeader className="pb-4 text-center space-y-1">
        <CardTitle className="text-3xl font-black tracking-tight">PRIME</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Gestão de metas e performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Senha</Label>
            <Input
              id="senha"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              className="h-11"
            />
          </div>
          <Button className="w-full h-11 text-sm font-bold tracking-wide uppercase" disabled={loading} onClick={signIn}>
            {loading ? "Entrando…" : "ENTRAR"}
          </Button>
          <button
            type="button"
            onClick={forgotPassword}
            disabled={recovering}
            className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {recovering ? "Enviando…" : "Esqueci minha senha"}
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full h-10" onClick={google}>
          Continuar com Google
        </Button>
      </CardContent>
    </Card>
  );
}
