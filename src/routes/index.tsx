import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, ShieldCheck, Workflow } from "lucide-react";
import { LoginCard } from "@/components/login-card";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRISMA — Inteligência para gestão e performance" },
      {
        name: "description",
        content:
          "Plataforma corporativa de gestão e performance: operação, indicadores, remuneração, metas e auditoria em um só lugar.",
      },
      { property: "og:title", content: "PRISMA — Inteligência para gestão e performance" },
      {
        property: "og:description",
        content: "Plataforma corporativa de gestão e performance: operação, indicadores, remuneração, metas e auditoria em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">DEX Invest</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            PRISMA
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">Inteligência para gestão e performance</p>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Substitua as planilhas de bonificação por um processo único: metas por loja, gatilho de faturamento,
            indicadores por cargo, conferência do Master e exportação para o financeiro.
          </p>
          <ul className="mt-8 space-y-4">
            <Feature
              icon={Workflow}
              title="Fluxo com responsabilidades claras"
              text="Gerente lança, o sistema calcula e o Master confere, aprova e fecha o período."
            />
            <Feature
              icon={BarChart3}
              title="Regras 100% configuráveis"
              text="Valores, pesos e critérios versionados por trimestre — sem nada fixo no código."
            />
            <Feature
              icon={ShieldCheck}
              title="Histórico imutável e auditável"
              text="Cada cálculo guarda a memória usada, com trilha de auditoria de todas as decisões."
            />
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">
          <LoginCard />
        </div>
      </div>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Workflow;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}
