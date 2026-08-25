import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  Gift,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  Star,
  WalletCards,
} from "lucide-react";

export type NavLeaf = {
  to: string;
  label: string;
  /** visible only for administrators */
  master?: boolean | undefined;
};

export type NavUniverse = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** base path used to detect the active universe */
  base: string;
  /** direct link when the universe has no submodules */
  to?: string | undefined;
  master?: boolean | undefined;
  items?: NavLeaf[] | undefined;
};

export const UNIVERSES: NavUniverse[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    base: "/dashboard",
    to: "/dashboard",
  },
  {
    id: "operacao",
    label: "Operação",
    icon: Building2,
    base: "/operacao",
    items: [
      { to: "/operacao/dashboard", label: "Dashboard" },
      { to: "/operacao/lojas", label: "Lojas" },
      { to: "/operacao/indicadores", label: "Indicadores" },
      { to: "/operacao/ocorrencias", label: "Ocorrências" },
      { to: "/operacao/plano-de-acao", label: "Plano de Ação" },
    ],
  },
  {
    id: "remuneracao",
    label: "Remuneração",
    icon: WalletCards,
    base: "/remuneracao",
    items: [
      { to: "/remuneracao/mensal/painel", label: "Remuneração Mensal · Dashboard" },
      { to: "/remuneracao/mensal/regras", label: "Remuneração Mensal · Motor de Regras", master: true },
      { to: "/remuneracao/mensal/lancamentos", label: "Remuneração Mensal · Lançamentos" },
      { to: "/remuneracao/mensal/metas", label: "Remuneração Mensal · Metas" },
      { to: "/remuneracao/mensal/periodos", label: "Remuneração Mensal · Períodos" },
      { to: "/remuneracao/plr/dashboard", label: "PLR Semestral · Dashboard" },
      { to: "/remuneracao/plr/regras", label: "PLR Semestral · Motor de Regras", master: true },
      { to: "/remuneracao/plr/apuracao", label: "PLR Semestral · Apuração" },
      { to: "/remuneracao/plr/resultados", label: "PLR Semestral · Resultados" },
      { to: "/remuneracao/plr/historico", label: "PLR Semestral · Histórico" },
    ],
  },
  {
    id: "kpi",
    label: "KPI",
    icon: ChartNoAxesCombined,
    base: "/kpi",
    items: [
      { to: "/kpi/dashboard", label: "Dashboard KPI" },
      { to: "/kpi/lojas", label: "Lojas" },
      { to: "/kpi/ifood", label: "iFood" },
      { to: "/kpi/99food", label: "99Food" },
      { to: "/kpi/indicadores", label: "Indicadores" },
      { to: "/kpi/ranking", label: "Ranking" },
      { to: "/kpi/comparativos", label: "Comparativos" },
      { to: "/kpi/historico", label: "Histórico" },
      { to: "/kpi/configuracoes", label: "Configurações", master: true },
    ],
  },
  {
    id: "beneficios",
    label: "Benefícios",
    icon: Gift,
    base: "/beneficios",
    items: [
      { to: "/beneficios/dashboard", label: "Dashboard" },
      { to: "/beneficios/beneficios", label: "Benefícios" },
      { to: "/beneficios/elegibilidade", label: "Elegibilidade" },
      { to: "/beneficios/funcionarios", label: "Funcionários" },
      { to: "/beneficios/movimentacoes", label: "Movimentações" },
      { to: "/beneficios/historico", label: "Histórico" },
    ],
  },
  {
    id: "treinamento",
    label: "Treinamento",
    icon: GraduationCap,
    base: "/treinamento",
    items: [
      { to: "/treinamento/dashboard", label: "Dashboard" },
      { to: "/treinamento/treinamentos", label: "Treinamentos" },
      { to: "/treinamento/trilhas", label: "Trilhas de Desenvolvimento" },
      { to: "/treinamento/agenda", label: "Agenda" },
      { to: "/treinamento/funcionarios", label: "Funcionários" },
      { to: "/treinamento/acompanhamento", label: "Acompanhamento" },
      { to: "/treinamento/historico", label: "Histórico" },
    ],
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    icon: Star,
    base: "/avaliacoes",
    items: [
      { to: "/avaliacoes/dashboard", label: "Dashboard" },
      { to: "/avaliacoes/avaliacoes", label: "Avaliações" },
      { to: "/avaliacoes/gerentes", label: "Avaliação de Gerentes" },
      { to: "/avaliacoes/funcionarios", label: "Avaliação de Funcionários" },
      { to: "/avaliacoes/ciclos", label: "Ciclos" },
      { to: "/avaliacoes/historico", label: "Histórico" },
    ],
  },
  {
    id: "auditorias",
    label: "Auditorias",
    icon: ClipboardCheck,
    base: "/auditorias",
    items: [
      { to: "/auditorias/dashboard", label: "Dashboard" },
      { to: "/auditorias/loja", label: "Auditoria de Loja" },
      { to: "/auditorias/checklists", label: "Checklists" },
      { to: "/auditorias/abertas", label: "Auditorias Abertas" },
      { to: "/auditorias/planos-de-acao", label: "Planos de Ação" },
      { to: "/auditorias/pendencias", label: "Pendências" },
      { to: "/auditorias/historico", label: "Histórico" },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    base: "/relatorios",
    items: [
      { to: "/relatorios/executivo", label: "Dashboard Executivo" },
      { to: "/relatorios/operacional", label: "Operacional" },
      { to: "/relatorios/financeiro", label: "Financeiro" },
      { to: "/relatorios/pessoas", label: "Pessoas" },
      { to: "/relatorios/kpi", label: "KPI" },
      { to: "/relatorios/remuneracao", label: "Remuneração" },
      { to: "/relatorios/treinamento", label: "Treinamento" },
      { to: "/relatorios/avaliacoes", label: "Avaliações" },
      { to: "/relatorios/auditorias", label: "Auditorias" },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    icon: Settings2,
    base: "/admin",
    master: true,
    items: [
      { to: "/admin/usuarios", label: "Usuários", master: true },
      { to: "/admin/cadastros", label: "Lojas, cargos e funcionários", master: true },
      { to: "/admin/permissoes", label: "Permissões", master: true },
      { to: "/admin/configuracoes", label: "Configurações", master: true },
      { to: "/admin/auditoria", label: "Auditoria do Sistema", master: true },
    ],
  },
];

export type Crumb = { label: string; to?: string | undefined };

/** Builds Universo › Módulo › Submódulo from the current pathname. */
export function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Dashboard", to: "/dashboard" }];
  const universe = UNIVERSES.find(
    (u) => u.base !== "/dashboard" && pathname.startsWith(u.base),
  );
  if (!universe) return crumbs;

  const first = universe.items?.find((i) => pathname.startsWith(i.to));
  crumbs.push({ label: universe.label, to: first?.to ?? universe.to });

  if (!first) return crumbs;
  for (const part of first.label.split(" · ")) {
    crumbs.push({ label: part });
  }
  return crumbs;
}

export function visibleUniverses(isMaster: boolean): NavUniverse[] {
  return UNIVERSES.filter((u) => !u.master || isMaster).map((u) => ({
    ...u,
    items: u.items?.filter((i) => !i.master || isMaster),
  }));
}

/** Human label for a placeholder path such as /kpi/ranking. */
export function labelForPath(pathname: string): { universe: string; module: string } {
  const universe = UNIVERSES.find((u) => pathname.startsWith(u.base));
  const item = universe?.items?.find((i) => pathname.startsWith(i.to));
  const parts = item?.label.split(" · ") ?? [];
  return {
    universe: universe?.label ?? "DEX Invest",
    module: parts.length ? parts.join(" · ") : "Módulo",
  };
}
