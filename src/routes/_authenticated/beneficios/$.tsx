import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/beneficios/$")({
  head: () => ({
    meta: [
      { title: "Benefícios | PRISMA" },
      { name: "description", content: "Universo de Benefícios da PRISMA: elegibilidade, movimentações e histórico por funcionário." },
      { property: "og:title", content: "Benefícios | PRISMA" },
      { property: "og:description", content: "Universo de Benefícios da PRISMA: elegibilidade, movimentações e histórico por funcionário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
