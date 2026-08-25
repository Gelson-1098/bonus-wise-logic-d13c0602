import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/metas")({
  beforeLoad: () => {
    throw redirect({ to: "/remuneracao/mensal/metas", replace: true });
  },
});
