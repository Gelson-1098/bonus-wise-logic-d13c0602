import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/relatorios/$")({
  head: () => ({
    meta: [
      { title: "Relatórios | VÉRTICE" },
      { name: "description", content: "Relatórios executivos, operacionais, financeiros e de pessoas da plataforma VÉRTICE." },
      { property: "og:title", content: "Relatórios | VÉRTICE" },
      { property: "og:description", content: "Relatórios executivos, operacionais, financeiros e de pessoas da plataforma VÉRTICE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
