import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lancamento")({
  beforeLoad: () => {
    throw redirect({ to: "/remuneracao/mensal/lancamentos", replace: true });
  },
});
