import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDefaultPasswordStatus, setDefaultPassword } from "@/lib/users.functions";
import { defaultPasswordSchema } from "@/lib/users-schemas";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("is_master");
    if (error || data !== true) throw redirect({ to: "/remuneracao/mensal/painel" });
  },
  head: () => ({
    meta: [
      { title: "Configurações | VÉRTICE" },
      {
        name: "description",
        content:
          "Configurações administrativas da VÉRTICE: segurança da plataforma e senha padrão utilizada nos novos acessos.",
      },
      { property: "og:title", content: "Configurações | VÉRTICE" },
      {
        property: "og:description",
        content:
          "Configurações administrativas da VÉRTICE: segurança da plataforma e senha padrão utilizada nos novos acessos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getDefaultPasswordStatus);
  const savePassword = useServerFn(setDefaultPassword);

  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState(false);

  const status = useQuery({
    queryKey: ["default-password-status"],
    queryFn: () => fetchStatus({}),
  });

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      const parsed = defaultPasswordSchema.safeParse({ password: value });
      if (!parsed.success) {
        throw new Error("A senha escolhida não atende aos requisitos mínimos de segurança.");
      }
      return savePassword({ data: parsed.data });
    },
    onSuccess: () => {
      toast.success("Senha padrão salva.", {
        description: "A nova senha será utilizada para novos usuários e futuras redefinições.",
      });
      setPassword("");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["default-password-status"] });
    },
    onError: (err: Error) =>
      toast.error("Não foi possível concluir a operação.", { description: err.message }),
  });

  const configured = status.data?.configured ?? false;

  return (
    <AppShell title="Configurações" description="Segurança e parâmetros administrativos da plataforma">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Segurança
            </CardTitle>
            <CardDescription>
              A senha padrão é usada na criação de novos usuários e nas redefinições feitas pelo
              Master. Ela fica protegida no servidor e nunca é exibida nem registrada em auditoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
              <KeyRound className="size-4 text-muted-foreground" />
              {configured ? (
                <span>
                  Senha padrão configurada: <strong>••••••••</strong>
                  {status.data?.updated_at && (
                    <span className="text-muted-foreground">
                      {" "}
                      — atualizada em{" "}
                      {new Date(status.data.updated_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-destructive">Nenhuma senha padrão configurada.</span>
              )}
            </div>

            {configured && !editing ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Alterar senha padrão
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="senha-padrao">Senha padrão</Label>
                  <Input
                    id="senha-padrao"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                  />
                </div>
                <div className="flex gap-2">
                  <Button disabled={mutation.isPending} onClick={() => mutation.mutate(password)}>
                    Salvar senha padrão
                  </Button>
                  {configured && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        setPassword("");
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Alterar a senha padrão não modifica a senha de usuários existentes: ela vale para
                  novos usuários e para futuras redefinições.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
