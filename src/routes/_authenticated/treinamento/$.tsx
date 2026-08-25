import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/treinamento/$")({
  head: () => ({
    meta: [
      { title: "Treinamento | DEX Invest" },
      { name: "description", content: "Universo de Treinamento da DEX Invest: trilhas de desenvolvimento, agenda e acompanhamento por colaborador." },
      { property: "og:title", content: "Treinamento | DEX Invest" },
      { property: "og:description", content: "Desenvolvimento e capacitação das equipes DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
