import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/remuneracao/plr/$")({
  head: () => ({
    meta: [
      { title: "PLR Semestral | PRISMA" },
      { name: "description", content: "Módulo de PLR Semestral da PRISMA, com motor de regras, apuração e resultados independentes da remuneração mensal." },
      { property: "og:title", content: "PLR Semestral | PRISMA" },
      { property: "og:description", content: "Módulo de PLR Semestral da PRISMA, com motor de regras, apuração e resultados independentes da remuneração mensal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
