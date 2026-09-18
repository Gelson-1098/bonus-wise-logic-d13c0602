import { createFileRoute } from "@tanstack/react-router";
import { LoginCard } from "@/components/login-card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | PRISMA" },
      {
        name: "description",
        content: "Acesse a PRISMA para lançar, conferir e aprovar a bonificação das lojas.",
      },
      { property: "og:title", content: "Entrar | PRISMA" },
      { property: "og:description", content: "Acesse a PRISMA para lançar, conferir e aprovar a bonificação das lojas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
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
