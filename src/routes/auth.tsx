import { createFileRoute } from "@tanstack/react-router";
import { LoginCard } from "@/components/login-card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | VÉRTICE" },
      {
        name: "description",
        content: "Acesse a VÉRTICE para lançar, conferir e aprovar a bonificação das lojas.",
      },
      { property: "og:title", content: "Entrar | VÉRTICE" },
      { property: "og:description", content: "Acesse a VÉRTICE para lançar, conferir e aprovar a bonificação das lojas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 px-4 py-12">
      <LoginCard />
    </div>
  );
}
