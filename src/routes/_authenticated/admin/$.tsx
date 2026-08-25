import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/admin/$")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("is_master");
    if (error || data !== true) throw redirect({ to: "/remuneracao/mensal/painel" });
  },
  head: () => ({
    meta: [
      { title: "Administração | DEX Invest" },
      { name: "description", content: "Administração da plataforma DEX Invest: usuários, permissões, configurações e auditoria do sistema." },
      { property: "og:title", content: "Administração | DEX Invest" },
      { property: "og:description", content: "Configuração e governança da plataforma DEX Invest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModulePlaceholder,
});
