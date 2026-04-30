import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Máximo 120 caracteres"),
  slug: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(80, "Máximo 80 caracteres")
    .regex(slugRegex, "Solo minúsculas, números y guiones"),
  category: z
    .string()
    .trim()
    .min(1, "La categoría es obligatoria")
    .max(80, "Máximo 80 caracteres"),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(2000, "Máximo 2000 caracteres"),
  active: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

const COMBINING_DIACRITICS = /[̀-ͯ]/g;
const NON_ALNUM = /[^a-z0-9]+/g;
const TRIM_DASHES = /^-+|-+$/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(NON_ALNUM, "-")
    .replace(TRIM_DASHES, "");
}
