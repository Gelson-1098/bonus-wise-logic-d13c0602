import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completeRequiredPasswordChange } from "@/lib/password.functions";
import { changePasswordSchema } from "@/lib/users-schemas";

export const Route = createFileRoute("/_authenticated/alterar-senha")({
  head: () => ({ meta: [
    { title: "Alterar senha | PRISMA" },
    { name: "description", content: "Altere sua senha de acesso ao PRISMA." },
    { property: "og:title", content: "Alterar senha | PRISMA" },
    { property: "og:description", content: "Altere sua senha de acesso ao PRISMA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeRequiredPasswordChange);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = changePasswordSchema.safeParse({
      current_password: currentPassword,
      password,
      confirm_password: confirmPassword,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise as senhas informadas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      current_password: parsed.data.current_password,
    });
    if (!error) await complete({});
    setLoading(false);
    if (error) {
      toast.error("Não foi possível alterar a senha.", { description: error.message });
      return;
    }
    toast.success("Senha alterada com sucesso.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AppShell title="Alterar senha" description="Atualize sua credencial de acesso">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Nova senha</CardTitle>
          <CardDescription>Informe sua senha atual e escolha uma nova senha segura.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="current-password">Senha atual</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
          <Button className="w-full" disabled={loading} onClick={submit}>{loading ? "Salvando…" : "Alterar senha"}</Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}