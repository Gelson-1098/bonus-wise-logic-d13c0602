import { z } from "zod";

export const ROLES = ["master", "gerente", "treinador"] as const;
export type AppRoleValue = (typeof ROLES)[number];

export const ROLE_LABEL: Record<AppRoleValue, string> = {
  master: "Master",
  gerente: "Gerente",
  treinador: "Treinador",
};

export const createUserSchema = z
  .object({
    full_name: z.string().trim().min(3, "Informe o nome completo.").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
    role: z.enum(ROLES),
    store_ids: z.array(z.string().uuid()),
  })
  .refine((v) => v.role === "master" || v.store_ids.length > 0, {
    message: "Selecione ao menos uma loja.",
    path: ["store_ids"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(3, "Informe o nome completo.").max(120),
});

export const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(ROLES),
});

export const updateStoresSchema = z.object({
  user_id: z.string().uuid(),
  store_ids: z.array(z.string().uuid()),
});

export const userIdSchema = z.object({ user_id: z.string().uuid() });

export const defaultPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "A senha padrão deve ter ao menos 8 caracteres.")
    .max(72, "A senha padrão deve ter no máximo 72 caracteres."),
});
