import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  activateUser,
  createUser,
  deactivateUser,
  getDefaultPasswordStatus,
  listUsers,
  resetUserPassword,
  updateUserRole,
  updateUserStores,
} from "@/lib/users.functions";
import {
  ROLES,
  ROLE_LABEL,
  createUserSchema,
  type AppRoleValue,
  type CreateUserInput,
} from "@/lib/users-schemas";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("is_master");
    if (error || data !== true) throw redirect({ to: "/remuneracao/mensal/painel" });
  },
  head: () => ({
    meta: [
      { title: "Usuários | PRISMA" },
      {
        name: "description",
        content:
          "Central de acessos da PRISMA: crie usuários, defina papéis, vincule lojas e redefina senhas com auditoria completa.",
      },
      { property: "og:title", content: "Usuários | PRISMA" },
      {
        property: "og:description",
        content:
          "Central de acessos da PRISMA: crie usuários, defina papéis, vincule lojas e redefina senhas com auditoria completa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsuariosPage,
});

type StoreRow = { id: string; name: string; active: boolean };

function StorePicker({
  stores,
  value,
  onChange,
}: {
  stores: StoreRow[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [term, setTerm] = useState("");
  const filtered = stores.filter((s) => s.name.toLowerCase().includes(term.toLowerCase()));

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar loja..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{value.length} lojas selecionadas</span>
        <span className="flex gap-2">
          <button
            type="button"
            className="underline-offset-4 hover:underline"
            onClick={() => onChange(filtered.map((s) => s.id))}
          >
            Selecionar todas
          </button>
          <button
            type="button"
            className="underline-offset-4 hover:underline"
            onClick={() => onChange([])}
          >
            Limpar seleção
          </button>
        </span>
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {filtered.map((store) => (
          <label
            key={store.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary"
          >
            <Checkbox
              checked={value.includes(store.id)}
              onCheckedChange={(c) => toggle(store.id, c === true)}
            />
            <span className="truncate">{store.name}</span>
          </label>
        ))}
        {!filtered.length && (
          <p className="px-1.5 py-2 text-sm text-muted-foreground">Nenhuma loja encontrada.</p>
        )}
      </div>
    </div>
  );
}

function UsuariosPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchPasswordStatus = useServerFn(getDefaultPasswordStatus);
  const create = useServerFn(createUser);
  const setRole = useServerFn(updateUserRole);
  const setStores = useServerFn(updateUserStores);
  const resetPassword = useServerFn(resetUserPassword);
  const activate = useServerFn(activateUser);
  const deactivate = useServerFn(deactivateUser);

  const [openNew, setOpenNew] = useState(false);
  const [created, setCreated] = useState<null | {
    full_name: string;
    email: string;
    role: AppRoleValue;
    stores: string[];
  }>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    run: () => Promise<void>;
  }>(null);
  const [storesDialog, setStoresDialog] = useState<null | { userId: string; selected: string[] }>(
    null,
  );

  const [term, setTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [storeFilter, setStoreFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers({}) });
  const passwordStatus = useQuery({
    queryKey: ["default-password-status"],
    queryFn: () => fetchPasswordStatus({}),
  });
  const storesQuery = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id,name,active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreRow[];
    },
  });

  const stores = useMemo(() => (storesQuery.data ?? []).filter((s) => s.active), [storesQuery.data]);
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? "—";

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { full_name: "", email: "", role: "gerente", store_ids: [] },
  });
  const role = form.watch("role");
  const storeIds = form.watch("store_ids");

  const createMutation = useMutation({
    mutationFn: (values: CreateUserInput) => create({ data: values }),
    onSuccess: (_res, values) => {
      toast.success("Usuário criado com sucesso.");
      setCreated({
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        stores: values.role === "master" ? [] : values.store_ids.map(storeName),
      });
      setOpenNew(false);
      form.reset({ full_name: "", email: "", role: "gerente", store_ids: [] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) =>
      toast.error("Não foi possível concluir a operação.", { description: err.message }),
  });

  async function runAction(promise: Promise<unknown>, success: string) {
    try {
      await promise;
      toast.success(success);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error("Não foi possível concluir a operação.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const users = usersQuery.data ?? [];
  const stats = {
    total: users.length,
    ativos: users.filter((u) => u.active).length,
    inativos: users.filter((u) => !u.active).length,
    masters: users.filter((u) => u.role === "master").length,
    gerentes: users.filter((u) => u.role === "gerente").length,
    treinadores: users.filter((u) => u.role === "treinador").length,
  };

  const filtered = users.filter((u) => {
    const matchTerm =
      !term ||
      (u.full_name ?? "").toLowerCase().includes(term.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(term.toLowerCase());
    const matchRole = roleFilter === "todos" || u.role === roleFilter;
    const matchStore = storeFilter === "todas" || u.store_ids.includes(storeFilter);
    const matchStatus =
      statusFilter === "todos" || (statusFilter === "ativos" ? u.active : !u.active);
    return matchTerm && matchRole && matchStore && matchStatus;
  });

  return (
    <AppShell
      title="Usuários"
      description="Gerencie acessos, perfis e lojas vinculadas."
      actions={
        <Button onClick={() => setOpenNew(true)}>
          <UserPlus className="size-4" /> Novo usuário
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Total de usuários"
            value={stats.total}
            loading={usersQuery.isLoading}
            icon={<Users className="size-[18px]" />}
          />
          <KpiCard
            label="Ativos"
            value={stats.ativos}
            loading={usersQuery.isLoading}
            icon={<CheckCircle2 className="size-[18px]" />}
          />
          <KpiCard
            label="Inativos"
            value={stats.inativos}
            loading={usersQuery.isLoading}
            icon={<XCircle className="size-[18px]" />}
          />
          <KpiCard
            label="Masters"
            value={stats.masters}
            loading={usersQuery.isLoading}
            icon={<ShieldCheck className="size-[18px]" />}
          />
          <KpiCard
            label="Gerentes"
            value={stats.gerentes}
            loading={usersQuery.isLoading}
            icon={<Store className="size-[18px]" />}
          />
          <KpiCard
            label="Treinadores"
            value={stats.treinadores}
            loading={usersQuery.isLoading}
            icon={<Users className="size-[18px]" />}
          />
        </div>

        {!passwordStatus.data?.configured && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
              <KeyRound className="size-4 text-destructive" />
              <span>
                Nenhuma senha padrão configurada. Defina-a em Administração &gt; Configurações &gt;
                Segurança antes de criar usuários.
              </span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="gap-3 pb-3">
            <CardTitle className="text-base">Acessos cadastrados</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou e-mail..."
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os papéis</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativos">Ativos</SelectItem>
                    <SelectItem value="inativos">Inativos</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Recarregar"
                  onClick={() => usersQuery.refetch()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando usuários...</p>
            ) : usersQuery.isError ? (
              <div className="py-8 text-center text-sm">
                <p className="text-destructive">Não foi possível carregar os usuários.</p>
                <Button variant="outline" className="mt-3" onClick={() => usersQuery.refetch()}>
                  <RefreshCw className="size-4" /> Tentar novamente
                </Button>
              </div>
            ) : !filtered.length ? (
              <EmptyState
                title="Nenhum usuário encontrado"
                description="Ajuste os filtros ou cadastre um novo acesso."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Nome</th>
                      <th className="px-2 py-2">E-mail</th>
                      <th className="px-2 py-2">Papel</th>
                      <th className="px-2 py-2">Lojas</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Último acesso</th>
                      <th className="px-2 py-2">Criado em</th>
                      <th className="px-2 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-t border-border">
                        <td className="px-2 py-2 font-medium">{u.full_name ?? "—"}</td>
                        <td className="px-2 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="px-2 py-2">
                          {u.role ? (
                            <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
                          ) : (
                            <Badge variant="outline">Sem papel</Badge>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {u.role === "master"
                            ? "Acesso global"
                            : u.store_ids.length
                              ? u.store_ids.map(storeName).join(", ")
                              : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={u.active ? "default" : "outline"}>
                            {u.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Ações">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="truncate">
                                {u.email ?? "Usuário"}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  toast.info(u.full_name ?? "Usuário", {
                                    description: `${ROLE_LABEL[u.role ?? "gerente"]} • ${
                                      u.role === "master"
                                        ? "acesso global"
                                        : `${u.store_ids.length} loja(s)`
                                    }`,
                                  })
                                }
                              >
                                <Eye className="size-4" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setStoresDialog({ userId: u.id, selected: u.store_ids })
                                }
                              >
                                <Store className="size-4" /> Alterar lojas
                              </DropdownMenuItem>
                              {ROLES.filter((r) => r !== u.role).map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  onClick={() =>
                                    setConfirm({
                                      title: `Definir papel: ${ROLE_LABEL[r]}`,
                                      description:
                                        "Alterar o papel modificará o nível de acesso deste usuário.",
                                      run: () =>
                                        runAction(
                                          setRole({ data: { user_id: u.id, role: r } }),
                                          "Papel atualizado.",
                                        ),
                                    })
                                  }
                                >
                                  <ShieldCheck className="size-4" /> Alterar para {ROLE_LABEL[r]}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirm({
                                    title: "Redefinir senha",
                                    description:
                                      "Redefinir a senha deste usuário para a senha padrão atual?",
                                    run: () =>
                                      runAction(
                                        resetPassword({ data: { user_id: u.id } }),
                                        "Senha redefinida para a senha padrão atual.",
                                      ),
                                  })
                                }
                              >
                                <KeyRound className="size-4" /> Redefinir senha
                              </DropdownMenuItem>
                              {u.active ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirm({
                                      title: "Desativar usuário",
                                      description:
                                        "O usuário perderá o acesso à plataforma até ser reativado.",
                                      run: () =>
                                        runAction(
                                          deactivate({ data: { user_id: u.id } }),
                                          "Usuário desativado.",
                                        ),
                                    })
                                  }
                                >
                                  <XCircle className="size-4" /> Desativar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirm({
                                      title: "Ativar usuário",
                                      description: "O usuário voltará a acessar a plataforma.",
                                      run: () =>
                                        runAction(
                                          activate({ data: { user_id: u.id } }),
                                          "Usuário ativado.",
                                        ),
                                    })
                                  }
                                >
                                  <CheckCircle2 className="size-4" /> Ativar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Novo usuário */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              A senha padrão atual será utilizada. Ela é definida em Configurações &gt; Segurança.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input id="full_name" {...form.register("full_name")} />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select
                value={role}
                onValueChange={(v) => form.setValue("role", v as AppRoleValue)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === "master" ? (
              <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
                Master possui acesso global — não é necessário vincular lojas.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label>Lojas</Label>
                <StorePicker
                  stores={stores}
                  value={storeIds}
                  onChange={(next) =>
                    form.setValue("store_ids", next, { shouldValidate: true })
                  }
                />
                {form.formState.errors.store_ids && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.store_ids.message as string}
                  </p>
                )}
              </div>
            )}
            <p className="flex items-center gap-2 rounded-md bg-secondary p-3 text-xs text-muted-foreground">
              <KeyRound className="size-4" /> Senha: •••••••• — senha padrão definida pela
              Administração.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Criar usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credenciais */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado com sucesso</DialogTitle>
            <DialogDescription>Repasse as credenciais ao usuário.</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Nome:</span> {created.full_name}
              </p>
              <p>
                <span className="text-muted-foreground">E-mail:</span> {created.email}
              </p>
              <p>
                <span className="text-muted-foreground">Papel:</span> {ROLE_LABEL[created.role]}
              </p>
              <p>
                <span className="text-muted-foreground">Loja:</span>{" "}
                {created.stores.length ? created.stores.join(", ") : "Acesso global"}
              </p>
              <p>
                <span className="text-muted-foreground">Senha:</span> •••••••••• (senha padrão da
                Administração)
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!created) return;
                const text = [
                  `Nome: ${created.full_name}`,
                  `E-mail: ${created.email}`,
                  `Papel: ${ROLE_LABEL[created.role]}`,
                  `Loja: ${created.stores.length ? created.stores.join(", ") : "Acesso global"}`,
                  "Senha: a senha padrão informada pela Administração",
                ].join("\n");
                void navigator.clipboard.writeText(text);
                toast.success("Credenciais copiadas.");
              }}
            >
              <Copy className="size-4" /> Copiar credenciais
            </Button>
            <Button onClick={() => setCreated(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alterar lojas */}
      <Dialog open={!!storesDialog} onOpenChange={(o) => !o && setStoresDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar lojas</DialogTitle>
            <DialogDescription>
              Gerentes e treinadores precisam de ao menos uma loja vinculada.
            </DialogDescription>
          </DialogHeader>
          {storesDialog && (
            <StorePicker
              stores={stores}
              value={storesDialog.selected}
              onChange={(next) => setStoresDialog({ ...storesDialog, selected: next })}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStoresDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!storesDialog) return;
                await runAction(
                  setStores({
                    data: { user_id: storesDialog.userId, store_ids: storesDialog.selected },
                  }),
                  "Vínculos de loja atualizados.",
                );
                setStoresDialog(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação genérica */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const action = confirm;
                setConfirm(null);
                await action?.run();
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
