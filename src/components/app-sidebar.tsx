import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-auth";
import { visibleUniverses } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

const STORAGE_KEY = "dex.sidebar.groups";

/** Router links are typed; nav paths come from the registry. */
function linkTo(to: string) {
  return { to } as unknown as { to: "/" };
}

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: access } = useAccess();
  const isMaster = access?.isMaster ?? false;
  const universes = visibleUniverses(isMaster);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOpen(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* estado de navegação é opcional */
    }
  }, []);

  function toggle(id: string, value: boolean) {
    setOpen((prev) => {
      const next = { ...prev, [id]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignora indisponibilidade de storage */
      }
      return next;
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="gap-0 px-4 py-4">
        <p className="truncate text-base font-semibold tracking-tight text-sidebar-accent-foreground">
          VÉR<span className="text-sidebar-primary">TICE</span>
        </p>
        {!collapsed && (
          <p className="mt-0.5 truncate text-xs text-sidebar-foreground/60">Plataforma corporativa</p>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {universes.map((universe) => {
                const universeActive = pathname.startsWith(universe.base);

                if (!universe.items?.length) {
                  return (
                    <SidebarMenuItem key={universe.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={universeActive}
                        tooltip={universe.label}
                        className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Link {...linkTo(universe.to ?? universe.base)}>
                          <universe.icon className="size-[18px]" />
                          <span>{universe.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                const expanded = open[universe.id] ?? universeActive;

                return (
                  <Collapsible
                    key={universe.id}
                    open={collapsed ? false : expanded}
                    onOpenChange={(v) => toggle(universe.id, v)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={universe.label}
                          isActive={universeActive}
                          className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-accent-foreground"
                        >
                          <universe.icon className="size-[18px]" />
                          <span>{universe.label}</span>
                          <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {universe.items.map((item, index) => {
                            const active = pathname.startsWith(item.to);
                            const parts = item.label.split(" · ");
                            const group = parts.length > 1 ? parts[0] : null;
                            const leaf = parts[parts.length - 1] ?? item.label;
                            const prevGroup =
                              index > 0
                                ? (universe.items?.[index - 1]?.label.split(" · ")[0] ?? null)
                                : null;
                            const showGroup = !!group && group !== prevGroup;
                            return (
                              <div key={item.to}>
                                {showGroup && (
                                  <p className="mt-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                                    {group}
                                  </p>
                                )}
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild isActive={active}>
                                    <Link {...linkTo(item.to)}>
                                      <span
                                        className={cn(
                                          "truncate",
                                          active && "font-medium text-sidebar-accent-foreground",
                                        )}
                                      >
                                        {leaf}
                                      </span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              </div>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 pb-1 text-xs">
            <p className="truncate font-medium text-sidebar-accent-foreground">
              {access?.fullName ?? access?.email ?? "—"}
            </p>
            <Badge
              variant="outline"
              className="mt-2 border-sidebar-border text-sidebar-foreground/80"
            >
              {isMaster ? "Administrador" : "Gerente"}
            </Badge>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair">
              <LogOut className="size-[18px]" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
