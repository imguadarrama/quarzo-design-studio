import { z } from "zod";
import { PENDING_URL_PREFIX } from "../AdminProductForm/schema.js";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imageUrlSchema = z
  .string()
  .min(1, "URL inválida")
  .refine(
    (v) => v.startsWith(PENDING_URL_PREFIX) || /^https:\/\//.test(v),
    "URL inválida",
  );

const swatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  imageUrl: imageUrlSchema,
  active: z.boolean(),
});

export const paletteFormSchema = z.object({
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
  swatches: z.array(swatchSchema).max(50, "Máximo 50 muestras"),
});

export type PaletteFormValues = z.infer<typeof paletteFormSchema>;
export type PaletteFormSwatch = PaletteFormValues["swatches"][number];

export { PENDING_URL_PREFIX } from "../AdminProductForm/schema.js";
