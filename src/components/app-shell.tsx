import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronRight, CircleHelp, LogOut, Search, Settings2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthorizationGate } from "@/hooks/use-auth";
import { buildCrumbs } from "@/lib/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function linkTo(to: string) {
  return { to } as unknown as { to: "/" };
}

function initials(name: string | null | undefined) {
  if (!name) return "DX";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Casca única da plataforma: sidebar hierárquica, header com breadcrumb,
 * busca global, notificações e perfil do usuário.
 */
export function PlatformShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = buildCrumbs(pathname);
  const { data: access } = useAccess();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <nav aria-label="Trilha de navegação" className="min-w-0 flex-1">
                <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {crumbs.map((crumb, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                      <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
                        {crumb.to && !last ? (
                          <Link
                            {...linkTo(crumb.to)}
                            className="transition-colors hover:text-foreground"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className={cn(last && "font-medium text-foreground")}>
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Busca global"
                  placeholder="Buscar loja, funcionário ou indicador..."
                  className="h-10 w-72 pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
                    <Bell className="size-[18px]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>Nenhuma notificação no momento</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-9 rounded-full bg-secondary p-0 text-xs font-semibold text-secondary-foreground"
                    aria-label="Perfil do usuário"
                  >
                    {initials(access?.fullName ?? access?.email)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {access?.fullName ?? access?.email ?? "Usuário"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="size-4" /> Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings2 className="size-4" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CircleHelp className="size-4" /> Ajuda
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
                {description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

/** Alias mantido para compatibilidade com as páginas existentes. */
export const AppShell = PlatformShell;
