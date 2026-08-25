import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/kpi/$")({
  head: () => ({
    meta: [
      { title: "KPI | DEX Invest" },
      { name: "description", content: "Camada central de indicadores de performance da DEX Invest: iFood, 99Food, ranking e comparativos." },
      { property: "og:title", content: "KPI | DEX Invest" },
      { property: "og:description", content: "Indicadores de performance das lojas DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
