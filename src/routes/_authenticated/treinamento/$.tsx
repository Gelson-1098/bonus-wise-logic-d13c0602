import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/treinamento/$")({
  head: () => ({
    meta: [
      { title: "Treinamento | PRISMA" },
      { name: "description", content: "Universo de Treinamento da PRISMA: trilhas de desenvolvimento, agenda e acompanhamento por colaborador." },
      { property: "og:title", content: "Treinamento | PRISMA" },
      { property: "og:description", content: "Universo de Treinamento da PRISMA: trilhas de desenvolvimento, agenda e acompanhamento por colaborador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
