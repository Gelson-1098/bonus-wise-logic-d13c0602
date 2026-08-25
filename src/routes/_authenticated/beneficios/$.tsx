import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/beneficios/$")({
  head: () => ({
    meta: [
      { title: "Benefícios | VÉRTICE" },
      { name: "description", content: "Universo de Benefícios da VÉRTICE: elegibilidade, movimentações e histórico por funcionário." },
      { property: "og:title", content: "Benefícios | VÉRTICE" },
      { property: "og:description", content: "Universo de Benefícios da VÉRTICE: elegibilidade, movimentações e histórico por funcionário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
