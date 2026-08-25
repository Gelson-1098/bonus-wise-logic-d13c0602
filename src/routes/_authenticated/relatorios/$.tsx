import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/relatorios/$")({
  head: () => ({
    meta: [
      { title: "Relatórios | DEX Invest" },
      { name: "description", content: "Relatórios executivos, operacionais, financeiros e de pessoas da plataforma DEX Invest." },
      { property: "og:title", content: "Relatórios | DEX Invest" },
      { property: "og:description", content: "Visões consolidadas dos módulos da plataforma DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
