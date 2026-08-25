import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/beneficios/$")({
  head: () => ({
    meta: [
      { title: "Benefícios | DEX Invest" },
      { name: "description", content: "Universo de Benefícios da DEX Invest: elegibilidade, movimentações e histórico por funcionário." },
      { property: "og:title", content: "Benefícios | DEX Invest" },
      { property: "og:description", content: "Gestão de benefícios dos colaboradores DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
