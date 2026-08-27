import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/auditorias/$")({
  head: () => ({
    meta: [
      { title: "Auditorias | PRISMA" },
      { name: "description", content: "Universo de Auditorias da PRISMA: checklists de loja, não conformidades, planos de ação e pendências." },
      { property: "og:title", content: "Auditorias | PRISMA" },
      { property: "og:description", content: "Universo de Auditorias da PRISMA: checklists de loja, não conformidades, planos de ação e pendências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
