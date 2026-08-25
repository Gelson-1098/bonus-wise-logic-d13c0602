import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros | DEX BONUS" },
      {
        name: "description",
        content: "Gerencie lojas, cargos, valores base e colaboradores elegíveis ao bônus da DEX Invest.",
      },
      { property: "og:title", content: "Cadastros | DEX BONUS" },
      { property: "og:description", content: "Lojas, cargos e colaboradores do programa de bonificação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CadastrosPage,
});

function CadastrosPage() {
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;

  return (
    <AppShell title="Cadastros" description="Lojas, cargos e colaboradores">
      <Tabs defaultValue="lojas">
        <TabsList>
          <TabsTrigger value="lojas">Lojas</TabsTrigger>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
        </TabsList>
        <TabsContent value="lojas" className="mt-4">
          <StoresTab editable={isMaster} />
        </TabsContent>
        <TabsContent value="cargos" className="mt-4">
          <PositionsTab editable={isMaster} />
        </TabsContent>
        <TabsContent value="colaboradores" className="mt-4">
          <EmployeesTab editable={isMaster} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StoresTab({ editable }: { editable: boolean }) {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", city: "", state: "" });

  const stores = useQuery({
    queryKey: ["stores-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id,name,code,city,state,active")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stores").insert({
        name: form.name,
        code: form.code || null,
        city: form.city || null,
        state: form.state || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Loja cadastrada.");
      setOpenNew(false);
      setForm({ name: "", code: "", city: "", state: "" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { error } = await supabase.from("stores").update({ active: v.active }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores-all"] }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{stores.data?.length ?? 0} loja(s)</CardTitle>
        {editable && (
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus className="size-4" /> Nova loja
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>UF</TableHead>
                <TableHead className="w-[90px]">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stores.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.code ?? "—"}</TableCell>
                  <TableCell>{s.city ?? "—"}</TableCell>
                  <TableCell>{s.state ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.active}
                      disabled={!editable}
                      onCheckedChange={(v) => toggle.mutate({ id: s.id, active: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova loja</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                ["name", "Nome"],
                ["code", "Código"],
                ["city", "Cidade"],
                ["state", "UF"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button className="w-full" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PositionsTab({ editable }: { editable: boolean }) {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", group_name: "", base_value: "" });

  const positions = useQuery({
    queryKey: ["positions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id,name,group_name,base_value,active")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: { base_value?: number | null; active?: boolean } }) => {
      const { error } = await supabase.from("positions").update(v.patch).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positions-all"] });
      qc.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("positions").insert({
        name: form.name,
        group_name: form.group_name || null,
        base_value: form.base_value === "" ? null : Number(form.base_value),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Cargo cadastrado.");
      setOpenNew(false);
      setForm({ name: "", group_name: "", base_value: "" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{positions.data?.length ?? 0} cargo(s)</CardTitle>
        {editable && (
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus className="size-4" /> Novo cargo
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="w-[170px]">Valor base (R$)</TableHead>
                <TableHead className="w-[90px]">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(positions.data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.group_name ?? "—"}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={p.base_value ?? ""}
                      disabled={!editable}
                      onBlur={(e) =>
                        update.mutate({
                          id: p.id,
                          patch: { base_value: e.target.value === "" ? null : Number(e.target.value) },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.active}
                      disabled={!editable}
                      onCheckedChange={(v) => update.mutate({ id: p.id, patch: { active: v } })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Nome</Label>
              <Input id="pname" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pgroup">Grupo</Label>
              <Input
                id="pgroup"
                value={form.group_name}
                onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pbase">Valor base (R$)</Label>
              <Input
                id="pbase"
                type="number"
                step="0.01"
                value={form.base_value}
                onChange={(e) => setForm((f) => ({ ...f, base_value: e.target.value }))}
              />
            </div>
            <Button className="w-full" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EmployeesTab({ editable }: { editable: boolean }) {
  const qc = useQueryClient();
  const [storeFilter, setStoreFilter] = useState("todas");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ full_name: "", store_id: "", position_id: "", registration: "", cpf: "" });

  const stores = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id,name").eq("active", true).order("name");
      return data ?? [];
    },
  });
  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data } = await supabase.from("positions").select("id,name,base_value").order("name");
      return data ?? [];
    },
  });

  const employees = useQuery({
    queryKey: ["employees", storeFilter],
    queryFn: async () => {
      let q = supabase
        .from("employees")
        .select("id,full_name,registration,active,bonus_eligible,store_id,position_id,stores(name),positions(name,base_value)")
        .order("full_name");
      if (storeFilter !== "todas") q = q.eq("store_id", storeFilter);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async (v: {
      id: string;
      patch: { active?: boolean; bonus_eligible?: boolean; position_id?: string; store_id?: string };
    }) => {
      const { error } = await supabase.from("employees").update(v.patch).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").insert({
        full_name: form.full_name,
        store_id: form.store_id,
        position_id: form.position_id || null,
        registration: form.registration || null,
        cpf: form.cpf || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado.");
      setOpenNew(false);
      setForm({ full_name: "", store_id: "", position_id: "", registration: "", cpf: "" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">{employees.data?.length ?? 0} colaborador(es)</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {(stores.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {editable && (
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus className="size-4" /> Novo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="min-w-[220px]">Cargo</TableHead>
                <TableHead className="text-right">Valor base</TableHead>
                <TableHead className="w-[90px]">Ativo</TableHead>
                <TableHead className="w-[110px]">Elegível</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(employees.data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell>{(e.stores as { name: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={e.position_id ?? ""}
                      disabled={!editable}
                      onValueChange={(v) => update.mutate({ id: e.id, patch: { position_id: v } })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(positions.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    {brl((e.positions as { base_value: number | null } | null)?.base_value ?? 0)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={e.active}
                      disabled={!editable}
                      onCheckedChange={(v) => update.mutate({ id: e.id, patch: { active: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={e.bonus_eligible}
                      disabled={!editable}
                      onCheckedChange={(v) => update.mutate({ id: e.id, patch: { bonus_eligible: v } })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ename">Nome completo</Label>
              <Input
                id="ename"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Loja</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm((f) => ({ ...f, store_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(stores.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select value={form.position_id} onValueChange={(v) => setForm((f) => ({ ...f, position_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(positions.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ereg">Matrícula</Label>
                <Input
                  id="ereg"
                  value={form.registration}
                  onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecpf">CPF</Label>
                <Input id="ecpf" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.full_name || !form.store_id || save.isPending}
              onClick={() => save.mutate()}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
