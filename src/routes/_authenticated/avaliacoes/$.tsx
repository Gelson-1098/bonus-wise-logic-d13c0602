import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/avaliacoes/$")({
  head: () => ({
    meta: [
      { title: "Avaliações | PRISMA" },
      { name: "description", content: "Universo de Avaliações da PRISMA: ciclos, avaliação de gerentes e de funcionários." },
      { property: "og:title", content: "Avaliações | PRISMA" },
      { property: "og:description", content: "Universo de Avaliações da PRISMA: ciclos, avaliação de gerentes e de funcionários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
