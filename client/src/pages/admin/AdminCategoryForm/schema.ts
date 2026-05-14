import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Máximo 120 caracteres"),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio")
    .max(120, "Máximo 120 caracteres")
    .regex(slugRegex, "Solo minúsculas, números y guiones"),
  active: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
