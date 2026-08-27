import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/kpi/$")({
  head: () => ({
    meta: [
      { title: "KPI | PRISMA" },
      { name: "description", content: "Camada central de indicadores de performance da PRISMA: iFood, 99Food, ranking e comparativos." },
      { property: "og:title", content: "KPI | PRISMA" },
      { property: "og:description", content: "Camada central de indicadores de performance da PRISMA: iFood, 99Food, ranking e comparativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
