import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f5f5] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_52%)]" />
      <div className="relative w-full max-w-[390px]">
        <LoginCard />
        <p className="mt-6 text-center text-[11px] tracking-wide text-neutral-400">Ambiente seguro e restrito</p>
      </div>
    </main>
  );
}
