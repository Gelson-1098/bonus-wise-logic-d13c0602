import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/kpi/$")({
  head: () => ({
    meta: [
      { title: "KPI | VÉRTICE" },
      { name: "description", content: "Camada central de indicadores de performance da VÉRTICE: iFood, 99Food, ranking e comparativos." },
      { property: "og:title", content: "KPI | VÉRTICE" },
      { property: "og:description", content: "Camada central de indicadores de performance da VÉRTICE: iFood, 99Food, ranking e comparativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
