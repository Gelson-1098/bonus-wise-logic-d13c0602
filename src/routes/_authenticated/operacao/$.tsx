import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/operacao/$")({
  head: () => ({
    meta: [
      { title: "Operação | PRISMA" },
      { name: "description", content: "Universo de Operação da PRISMA: lojas, indicadores, ocorrências e planos de ação." },
      { property: "og:title", content: "Operação | PRISMA" },
      { property: "og:description", content: "Universo de Operação da PRISMA: lojas, indicadores, ocorrências e planos de ação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
