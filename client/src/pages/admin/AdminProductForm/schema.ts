import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_IMAGE_BYTES = 500_000;

const dataUrlOrHttp = z
  .string()
  .min(1, "URL inválida")
  .refine(
    (v) => v.startsWith("data:image/") || /^https?:\/\//.test(v),
    "URL inválida",
  );

const dataUrlSizeOk = (v: string): boolean => {
  if (!v.startsWith("data:image/")) return true;
  const b64 = v.split(",", 2)[1] ?? "";
  return Math.floor(b64.length * 0.75) <= MAX_IMAGE_BYTES;
};

const imageSchema = z.object({
  url: dataUrlOrHttp.refine(dataUrlSizeOk, "Máximo 500 KB"),
  alt: z
    .string()
    .trim()
    .max(160, "Máximo 160 caracteres")
    .optional()
    .or(z.literal("")),
});

const optionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(80, "Máximo 80 caracteres"),
    type: z.enum(["SELECT", "TEXT"]),
    values: z
      .array(z.string().trim().min(1).max(80))
      .max(50, "Máximo 50 valores")
      .optional(),
    required: z.boolean(),
  })
  .superRefine((opt, ctx) => {
    if (opt.type === "SELECT" && (!opt.values || opt.values.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["values"],
        message: "Agrega al menos un valor",
      });
    }
  });

const variantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  price: z.coerce
    .number({ invalid_type_error: "Precio inválido" })
    .min(0, "El precio no puede ser negativo")
    .max(999999, "Precio demasiado alto"),
  options: z.array(optionSchema).max(8, "Máximo 8 opciones por variante"),
});

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
  images: z.array(imageSchema).max(8, "Máximo 8 imágenes"),
  variants: z
    .array(variantSchema)
    .min(1, "Agrega al menos una variante")
    .max(12, "Máximo 12 variantes"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type ProductFormImage = ProductFormValues["images"][number];
export type ProductFormVariant = ProductFormValues["variants"][number];
export type ProductFormVariantOption = ProductFormVariant["options"][number];

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
