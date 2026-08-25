import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/auditorias/$")({
  head: () => ({
    meta: [
      { title: "Auditorias | DEX Invest" },
      { name: "description", content: "Universo de Auditorias da DEX Invest: checklists de loja, não conformidades, planos de ação e pendências." },
      { property: "og:title", content: "Auditorias | DEX Invest" },
      { property: "og:description", content: "Auditoria operacional das lojas DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
