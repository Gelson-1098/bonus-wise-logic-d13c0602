import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cadastros")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/cadastros", replace: true });
  },
});
