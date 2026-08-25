import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  SlidersHorizontal,
  Building2,
  History,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard, master: false },
  { to: "/lancamento", label: "Lançamento", icon: ClipboardList, master: false },
  { to: "/metas", label: "Metas", icon: Target, master: false },
  { to: "/periodos", label: "Períodos", icon: CalendarRange, master: false },
  { to: "/regras", label: "Motor de regras", icon: SlidersHorizontal, master: true },
  { to: "/cadastros", label: "Cadastros", icon: Building2, master: true },
  { to: "/auditoria", label: "Auditoria", icon: History, master: true },
] as const;


export function AppShell({
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
  const { data: access } = useAccess();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMaster = access?.isMaster ?? false;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="text-lg font-semibold tracking-tight text-sidebar-accent-foreground">
            DEX <span className="text-sidebar-primary">BONUS</span>
          </p>
          <p className="mt-1 text-xs text-sidebar-foreground/70">Gestão de bonificação</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter((i) => !i.master || isMaster).map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs">
          <p className="truncate font-medium text-sidebar-accent-foreground">
            {access?.fullName ?? access?.email ?? "—"}
          </p>
          <Badge variant="outline" className="mt-2 border-sidebar-border text-sidebar-foreground/80">
            {isMaster ? "Master" : "Gerente"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            onClick={signOut}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
          {NAV.filter((i) => !i.master || isMaster).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                pathname.startsWith(item.to) ? "bg-secondary font-medium" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="min-w-0 flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
