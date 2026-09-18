import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveEmployeeImport } from "@/lib/employee-import.functions";
import { readEmployeeImport, type EmployeeImportSourceRow } from "@/lib/employee-import";
import { findDbStore, normalizeKey, resolveStore } from "@/lib/store-registry";

type Store = { id: string; name: string; code: string | null };
type Position = { id: string; name: string; active?: boolean };
type ExistingEmployee = { full_name: string; store_id: string; registration?: string | null; cpf?: string | null };
type ReviewRow = EmployeeImportSourceRow & { id: string; storeId: string; positionId: string };

function matchStore(value: string, stores: Store[]) {
  const key = normalizeKey(value);
  const direct = stores.filter((store) => normalizeKey(store.name) === key || normalizeKey(store.code) === key);
  if (direct.length === 1) return direct[0]!.id;
  const resolution = resolveStore({ name: value, code: value });
  return resolution.status === "ok" && resolution.store ? findDbStore(resolution.store, stores)?.id ?? "" : "";
}

function matchPosition(value: string, positions: Position[]) {
  const key = normalizeKey(value);
  const matches = positions.filter((position) => normalizeKey(position.name) === key);
  return matches.length === 1 ? matches[0]!.id : "";
}

export function EmployeeImportDialog({ open, onOpenChange, stores, positions, existing, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; stores: Store[]; positions: Position[];
  existing: ExistingEmployee[]; onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const saveImport = useServerFn(saveEmployeeImport);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const duplicates = useMemo(() => ({
    registrations: new Set(existing.map((row) => normalizeKey(row.registration)).filter(Boolean)),
    cpfs: new Set(existing.map((row) => (row.cpf ?? "").replace(/\D/g, "")).filter(Boolean)),
    names: new Set(existing.map((row) => `${normalizeKey(row.full_name)}|${row.store_id}`)),
  }), [existing]);

  const status = (row: ReviewRow) => {
    if (!row.fullName.trim()) return "Nome não identificado";
    if (!row.storeId) return "Loja não identificada";
    if (!row.positionId) return "Cargo não identificado";
    const registration = normalizeKey(row.registration);
    const cpf = row.cpf.replace(/\D/g, "");
    if ((registration && duplicates.registrations.has(registration)) || (cpf && duplicates.cpfs.has(cpf)) || duplicates.names.has(`${normalizeKey(row.fullName)}|${row.storeId}`)) return "Já cadastrado";
    return "Pronto";
  };
  const validRows = rows.filter((row) => status(row) === "Pronto");
  const unresolved = rows.filter((row) => !["Pronto", "Já cadastrado"].includes(status(row))).length;

  async function selectFile(file?: File) {
    if (!file) return;
    setReading(true);
    try {
      const parsed = await readEmployeeImport(file);
      if (!parsed.length) throw new Error("Não encontramos uma tabela com as colunas Funcionário, Loja e Cargo.");
      setFileName(file.name);
      setRows(parsed.map((row, index) => ({ ...row, id: `${row.rowNumber}-${index}`, storeId: matchStore(row.store, stores), positionId: matchPosition(row.position, positions) })));
    } catch (error) {
      toast.error("Não foi possível ler o arquivo", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }
  async function save() {
    if (!validRows.length || unresolved) return;
    setSaving(true);
    try {
      const result = await saveImport({ data: { rows: validRows.map((row) => ({ full_name: row.fullName, store_id: row.storeId, position_id: row.positionId, registration: row.registration || null, cpf: row.cpf || null })) } });
      toast.success(`${result.imported} colaborador(es) importado(s).`, result.skipped ? { description: `${result.skipped} duplicado(s) ignorado(s).` } : undefined);
      setRows([]); setFileName(""); onOpenChange(false); onSaved();
    } catch (error) {
      toast.error("Importação não concluída", { description: error instanceof Error ? error.message : String(error) });
    } finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden p-0">
      <DialogHeader className="border-b px-6 py-5"><DialogTitle>Importar colaboradores</DialogTitle><DialogDescription>Envie PDF, Excel ou CSV. Confira nome, loja e cargo antes de salvar.</DialogDescription></DialogHeader>
      <div className="space-y-4 overflow-y-auto px-6 pb-6">
        <input ref={inputRef} className="hidden" type="file" accept=".pdf,.xls,.xlsx,.csv,application/pdf" onChange={(event) => selectFile(event.target.files?.[0])} />
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/25 px-5 py-7 text-sm transition-colors hover:bg-muted/50"><span className="flex size-10 items-center justify-center rounded-lg border bg-background"><Upload className="size-4" /></span><span className="text-left"><strong className="block font-medium">{reading ? "Lendo arquivo…" : "Selecionar arquivo"}</strong><span className="text-xs text-muted-foreground">{fileName || "PDF, XLS, XLSX ou CSV"}</span></span></button>
        {rows.length > 0 && <>
          <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="secondary">{rows.length} registro(s)</Badge><Badge variant="outline">{validRows.length} pronto(s)</Badge>{unresolved > 0 && <Badge variant="destructive">{unresolved} para corrigir</Badge>}</div>
          <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Linha</TableHead><TableHead className="min-w-52">Funcionário</TableHead><TableHead className="min-w-52">Loja</TableHead><TableHead className="min-w-52">Cargo</TableHead><TableHead>Matrícula</TableHead><TableHead>CPF</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
            const rowStatus = status(row);
            return <TableRow key={row.id}><TableCell>{row.rowNumber}</TableCell><TableCell><Input value={row.fullName} onChange={(event) => updateRow(row.id, { fullName: event.target.value })} /></TableCell><TableCell><Select value={row.storeId} onValueChange={(value) => updateRow(row.id, { storeId: value })}><SelectTrigger><SelectValue placeholder={row.store || "Selecionar loja"} /></SelectTrigger><SelectContent>{stores.map((store) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Select value={row.positionId} onValueChange={(value) => updateRow(row.id, { positionId: value })}><SelectTrigger><SelectValue placeholder={row.position || "Selecionar cargo"} /></SelectTrigger><SelectContent>{positions.filter((position) => position.active !== false).map((position) => <SelectItem key={position.id} value={position.id}>{position.name}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Input value={row.registration} onChange={(event) => updateRow(row.id, { registration: event.target.value })} /></TableCell><TableCell><Input value={row.cpf} onChange={(event) => updateRow(row.id, { cpf: event.target.value.replace(/\D/g, "") })} /></TableCell><TableCell><Badge variant={rowStatus === "Pronto" ? "secondary" : rowStatus === "Já cadastrado" ? "outline" : "destructive"}>{rowStatus}</Badge></TableCell></TableRow>;
          })}</TableBody></Table></div>
          <div className="flex items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">Duplicados não serão criados. Corrija todos os registros pendentes para continuar.</p><Button disabled={saving || unresolved > 0 || validRows.length === 0} onClick={save}><FileSpreadsheet className="size-4" />{saving ? "Salvando…" : `Salvar ${validRows.length} colaborador(es)`}</Button></div>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}