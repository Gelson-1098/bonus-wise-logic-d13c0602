import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/periodos")({
  beforeLoad: () => {
    throw redirect({ to: "/remuneracao/mensal/periodos", replace: true });
  },
});
