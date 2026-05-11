import { VariantOptionType } from "@prisma/client";
import { z } from "zod";

export const imageUrlSchema = z
  .string()
  .trim()
  .regex(/^https:\/\//, "Image must be an https URL");

export const variantOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.nativeEnum(VariantOptionType),
    values: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    required: z.boolean().default(true),
  })
  .superRefine((opt, ctx) => {
    if (opt.type === VariantOptionType.SELECT) {
      if (!opt.values || opt.values.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["values"],
          message: "Las opciones de tipo SELECT requieren al menos un valor",
        });
      }
    }
  });

export const variantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(80),
  price: z.coerce.number().min(0).max(999999),
  options: z.array(variantOptionSchema).max(8).default([]),
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
  category: z.string().trim().min(1).max(80),
  active: z.coerce.boolean().default(true),
  images: z.array(imageSchema).max(8, "Máximo 8 imágenes por producto").default([]),
  variants: z.array(variantSchema).max(12).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;
