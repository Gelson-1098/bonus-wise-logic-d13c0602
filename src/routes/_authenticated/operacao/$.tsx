import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/operacao/$")({
  head: () => ({
    meta: [
      { title: "Operação | DEX Invest" },
      { name: "description", content: "Universo de Operação da plataforma DEX Invest: lojas, indicadores, ocorrências e planos de ação." },
      { property: "og:title", content: "Operação | DEX Invest" },
      { property: "og:description", content: "Gestão operacional das lojas DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
