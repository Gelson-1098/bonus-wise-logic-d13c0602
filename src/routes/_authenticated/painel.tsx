import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/painel")({
  beforeLoad: () => {
    throw redirect({ to: "/remuneracao/mensal/painel", replace: true });
  },
});
