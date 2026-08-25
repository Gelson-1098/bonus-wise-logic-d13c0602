import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/avaliacoes/$")({
  head: () => ({
    meta: [
      { title: "Avaliações | DEX Invest" },
      { name: "description", content: "Universo de Avaliações da DEX Invest: ciclos, avaliação de gerentes e de funcionários." },
      { property: "og:title", content: "Avaliações | DEX Invest" },
      { property: "og:description", content: "Ciclos de avaliação das equipes DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
