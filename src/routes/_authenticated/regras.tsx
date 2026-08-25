import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/regras")({
  beforeLoad: () => {
    throw redirect({ to: "/remuneracao/mensal/regras", replace: true });
  },
});
