import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// `pending:<tempId>` is the form-only sentinel for an image the operator
// has picked but not yet uploaded — see ProductImageEditor + the
// AdminProductFormPage submit phase. The form orchestrator transforms
// these into real https URLs at submit time before the payload reaches
// the server.
export const PENDING_URL_PREFIX = "pending:";

const imageUrlSchema = z
  .string()
  .min(1, "URL inválida")
  .refine(
    (v) => v.startsWith(PENDING_URL_PREFIX) || /^https:\/\//.test(v),
    "URL inválida",
  );

const imageSchema = z.object({
  url: imageUrlSchema,
  alt: z
    .string()
    .trim()
    .max(160, "Máximo 160 caracteres")
    .optional()
    .or(z.literal("")),
});

const variantKindSchema = z.enum([
  "CON_FOIL",
  "CON_TINTA_NORMAL",
  "CON_FOIL_Y_TINTA",
  "PAPEL_TEXTURIZADO",
]);

const variantPriceSchema = z.object({
  kind: variantKindSchema,
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  price: z.coerce
    .number({ invalid_type_error: "Precio inválido" })
    .min(0, "El precio no puede ser negativo")
    .max(999999, "Precio demasiado alto"),
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
    .array(variantPriceSchema)
    .length(4, "El producto requiere los 4 tipos de variante"),
  designIds: z.array(z.string().min(1)).max(200, "Demasiados diseños seleccionados"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type ProductFormImage = ProductFormValues["images"][number];
export type ProductFormVariantPrice = ProductFormValues["variants"][number];

export { slugify } from "@/lib/slug";
