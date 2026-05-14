import { VariantKind } from "@prisma/client";
import { z } from "zod";

export const imageUrlSchema = z
  .string()
  .trim()
  .regex(/^https:\/\//, "Image must be an https URL");

export const variantPriceSchema = z
  .object({
    kind: z.nativeEnum(VariantKind),
    price: z.coerce.number().min(0).max(999999),
    offered: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.offered && v.price <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "El precio debe ser mayor a 0 si la variante se ofrece",
      });
    }
  });

export const imageSchema = z.object({
  url: imageUrlSchema,
  alt: z.string().trim().max(160).optional().or(z.literal("")),
});

export const productSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  active: z.coerce.boolean().default(true),
  images: z.array(imageSchema).max(8, "Máximo 8 imágenes por producto").default([]),
  variants: z
    .array(variantPriceSchema)
    .length(4, "Cada producto requiere los 4 tipos de variante")
    .superRefine((variants, ctx) => {
      const seen = new Set<VariantKind>();
      for (const v of variants) {
        if (seen.has(v.kind)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants"],
            message: `Variante duplicada: ${v.kind}`,
          });
          return;
        }
        seen.add(v.kind);
      }
      for (const kind of Object.values(VariantKind)) {
        if (!seen.has(kind)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants"],
            message: `Falta la variante: ${kind}`,
          });
        }
      }
      const offeredCount = variants.filter((v) => v.offered).length;
      if (offeredCount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: "Al menos una variante debe estar marcada como ofrecida",
        });
      }
    }),
  designIds: z.array(z.string().cuid()).max(200).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug inválido"),
  active: z.boolean().default(true),
  position: z.number().int().min(0).optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const designSchema = z.object({
  name: z.string().trim().min(1).max(120),
  imageUrl: imageUrlSchema,
  active: z.boolean().default(true),
  position: z.number().int().min(0).optional(),
  compatibleKinds: z
    .array(z.nativeEnum(VariantKind))
    .max(4, "Máximo 4 variantes compatibles")
    .default([]),
  categoryIds: z
    .array(z.string().cuid())
    .max(20, "Máximo 20 categorías")
    .default([]),
});

export type DesignInput = z.infer<typeof designSchema>;

export const swatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  imageUrl: imageUrlSchema,
  active: z.boolean().default(true),
});

export const palettePayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug inválido"),
  active: z.boolean().default(true),
  swatches: z.array(swatchSchema).max(50, "Máximo 50 muestras").default([]),
});

export type PaletteInput = z.infer<typeof palettePayloadSchema>;
