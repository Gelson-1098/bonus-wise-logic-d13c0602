import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { transitionPeriod } from "@/lib/bonus.functions";
import { AppShell } from "@/components/app-shell";
import { PeriodPicker } from "@/components/period-picker";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, pct, periodLabel, PERIOD_STATUS_LABEL, RESULT_STATUS_LABEL, statusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/remuneracao/mensal/periodos")({
  head: () => ({
    meta: [
      { title: "Períodos e conferência | DEX BONUS" },
      {
        name: "description",
        content:
          "Confira, aprove, feche e exporte os períodos de bonificação de cada loja com histórico imutável.",
      },
      { property: "og:title", content: "Períodos e conferência | DEX BONUS" },
      { property: "og:description", content: "Fluxo de conferência e aprovação do bônus mensal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeriodosPage,
});

type Action = "aprovar" | "solicitar_correcao" | "fechar" | "reabrir" | "pagar";

const ACTION_LABEL: Record<Action, string> = {
  aprovar: "Aprovar",
  solicitar_correcao: "Solicitar correção",
  fechar: "Fechar período",
  reabrir: "Reabrir",
  pagar: "Marcar como pago",
};

function PeriodosPage() {
  const now = new Date();
  const qc = useQueryClient();
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [dialog, setDialog] = useState<{ id: string; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const transition = useServerFn(transitionPeriod);

  const { data, isLoading } = useQuery({
    queryKey: ["periodos", period.month, period.year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_periods")
        .select(
          "id,status,month,year,store_id,review_note,stores(name),store_targets(target_calculated,target_adjusted,revenue_actual),employee_period_entries(id,calculated_value,approved_value,result_status,no_bonus,no_bonus_reason,employees(full_name,cpf,registration),positions(name))",
        )
        .eq("month", period.month)
        .eq("year", period.year);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (v: { id: string; action: Action; note: string }) =>
      transition({ data: { period_id: v.id, action: v.action, note: v.note || null } }),
    onSuccess: () => {
      toast.success("Situação do período atualizada.");
      setDialog(null);
      setNote("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Ação não permitida", { description: e.message }),
  });

  function exportPeriod(row: (typeof rows)[number]) {
    const sheet = row.entries.map((e) => ({
      Loja: row.store,
      Competência: periodLabel(period.month, period.year),
      Colaborador: e.employee,
      CPF: e.cpf ?? "",
      Matrícula: e.registration ?? "",
      Cargo: e.position,
      Resultado: RESULT_STATUS_LABEL[e.result_status] ?? e.result_status,
      "Valor a pagar": Number(e.value),
      Justificativa: e.reason ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Bonus");
    XLSX.writeFile(wb, `bonus-${row.store}-${period.month}-${period.year}.xlsx`.replace(/\s+/g, "_"));
  }

  const rows = (data ?? [])
    .map((p) => {
      const t = p.store_targets as unknown as {
        target_calculated: number | null;
        target_adjusted: number | null;
        revenue_actual: number | null;
      } | null;
      const target = t?.target_adjusted ?? t?.target_calculated ?? null;
      const revenue = t?.revenue_actual ?? null;
      const entries = (p.employee_period_entries as unknown as Array<{
        id: string;
        calculated_value: number;
        approved_value: number | null;
        result_status: string;
        no_bonus_reason: string | null;
        employees: { full_name: string; cpf: string | null; registration: string | null } | null;
        positions: { name: string } | null;
      }>).map((e) => ({
        id: e.id,
        employee: e.employees?.full_name ?? "—",
        cpf: e.employees?.cpf ?? null,
        registration: e.employees?.registration ?? null,
        position: e.positions?.name ?? "—",
        result_status: e.result_status,
        reason: e.no_bonus_reason,
        value: Number(e.approved_value ?? e.calculated_value ?? 0),
      }));
      return {
        id: p.id,
        store: (p.stores as unknown as { name: string } | null)?.name ?? "—",
        status: p.status as string,
        review_note: p.review_note,
        attainment:
          target && Number(target) > 0 && revenue !== null ? (Number(revenue) / Number(target)) * 100 : null,
        total: entries.reduce((s, e) => s + e.value, 0),
        entries,
      };
    })
    .sort((a, b) => a.store.localeCompare(b.store));

  function actionsFor(status: string): Action[] {
    if (!isMaster) return [];
    switch (status) {
      case "enviado":
      case "em_conferencia":
        return ["aprovar", "solicitar_correcao"];
      case "aprovado":
        return ["fechar", "reabrir"];
      case "fechado":
        return ["pagar", "reabrir"];
      case "pago":
        return [];
      default:
        return ["reabrir"];
    }
  }

  return (
    <AppShell
      title="Períodos e conferência"
      description={`Competência ${periodLabel(period.month, period.year)}`}
      actions={<PeriodPicker month={period.month} year={period.year} onChange={setPeriod} />}
    >
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && rows.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Nenhum período nesta competência.
            </CardContent>
          </Card>
        )}
        {rows.map((row) => (
          <Card key={row.id}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{row.store}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atingimento {pct(row.attainment)} · {row.entries.length} colaborador(es)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn(statusTone(row.status))}>
                  {PERIOD_STATUS_LABEL[row.status] ?? row.status}
                </Badge>
                <span className="text-sm font-semibold">{brl(row.total)}</span>
                <Button variant="outline" size="sm" onClick={() => exportPeriod(row)}>
                  <Download className="size-4" /> Exportar
                </Button>
                {actionsFor(row.status).map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant={a === "aprovar" ? "default" : "outline"}
                    onClick={() => {
                      setNote(a === "reabrir" ? "" : row.review_note ?? "");
                      setDialog({ id: row.id, action: a });
                    }}
                  >
                    {ACTION_LABEL[a]}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Justificativa</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.employee}</TableCell>
                        <TableCell>{e.position}</TableCell>
                        <TableCell>{RESULT_STATUS_LABEL[e.result_status] ?? e.result_status}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                          {e.reason ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{brl(e.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog ? ACTION_LABEL[dialog.action] : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="note">
                {dialog?.action === "reabrir" ? "Motivo da reabertura (obrigatório)" : "Observação"}
              </Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                disabled={mutation.isPending}
                onClick={() => dialog && mutation.mutate({ id: dialog.id, action: dialog.action, note })}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
