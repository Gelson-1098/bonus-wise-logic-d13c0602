import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria | PRISMA" },
      {
        name: "description",
        content: "Histórico completo de cálculos, aprovações, reaberturas e justificativas do bônus.",
      },
      { property: "og:title", content: "Auditoria | PRISMA" },
      { property: "og:description", content: "Histórico completo de cálculos, aprovações, reaberturas e justificativas do bônus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,created_at,user_email,action,entity,description,old_value,new_value")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <AppShell title="Auditoria" description="Últimos 300 registros de alterações">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trilha de auditoria</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>De → Para</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {(data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{l.action}</TableCell>
                    <TableCell className="text-xs">{l.entity ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.user_email ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.old_value || l.new_value ? `${l.old_value ?? "—"} → ${l.new_value ?? "—"}` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[360px] text-xs text-muted-foreground">
                      {l.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Nenhum registro ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
