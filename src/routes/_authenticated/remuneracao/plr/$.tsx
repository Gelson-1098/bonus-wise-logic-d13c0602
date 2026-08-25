import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/remuneracao/plr/$")({
  head: () => ({
    meta: [
      { title: "PLR Semestral | DEX Invest" },
      { name: "description", content: "Módulo de PLR Semestral da DEX Invest, com motor de regras, apuração e resultados independentes da remuneração mensal." },
      { property: "og:title", content: "PLR Semestral | DEX Invest" },
      { property: "og:description", content: "Participação nos resultados por semestre nas lojas DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
