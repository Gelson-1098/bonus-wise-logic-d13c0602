import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | VÉRTICE" },
      {
        name: "description",
        content: "Defina uma nova senha de acesso à plataforma VÉRTICE de gestão e performance.",
      },
      { property: "og:title", content: "Redefinir senha | VÉRTICE" },
      {
        property: "og:description",
        content: "Defina uma nova senha de acesso à plataforma VÉRTICE de gestão e performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir a senha", { description: error.message });
      return;
    }
    toast.success("Senha redefinida com sucesso.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 px-4 py-12">
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Redefinir senha</CardTitle>
          <CardDescription>Defina a nova senha de acesso ao VÉRTICE.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nova">Nova senha</Label>
            <Input
              id="nova"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirma">Confirmar senha</Label>
            <Input
              id="confirma"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button className="w-full" disabled={loading} onClick={submit}>
            Salvar nova senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
