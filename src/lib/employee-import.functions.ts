import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  rows: z.array(z.object({
    full_name: z.string().trim().min(2).max(200),
    store_id: z.string().uuid(),
    position_id: z.string().uuid(),
    registration: z.string().trim().max(80).nullable().optional(),
    cpf: z.string().trim().max(30).nullable().optional(),
  })).min(1).max(1000),
});

export const saveEmployeeImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const module = await import("@/lib/employee-import.server");
    return module.importEmployees(context.supabase, data.rows);
  });
