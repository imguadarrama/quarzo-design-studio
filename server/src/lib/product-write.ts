import { Decimal } from "@prisma/client/runtime/library";
import { VariantOptionType } from "@prisma/client";
import type { ProductInput } from "./validation-schemas.js";

export const buildVariantsCreate = (variants: ProductInput["variants"]) =>
  variants.map((variant) => ({
    name: variant.name,
    sku: variant.sku,
    price: new Decimal(variant.price.toFixed(2)),
    options: {
      create: variant.options.map((option, index) => ({
        name: option.name,
        type: option.type,
        values:
          option.type === VariantOptionType.SELECT ? (option.values ?? []) : undefined,
        required: option.required,
        position: index,
      })),
    },
  }));

export const buildImagesCreate = (images: ProductInput["images"]) =>
  images.map((image, index) => ({
    url: image.url,
    alt: image.alt || null,
    position: index,
  }));

export const buildProductWriteInput = (input: ProductInput) => ({
  slug: input.slug,
  name: input.name,
  description: input.description,
  category: input.category,
  active: input.active,
  images: { create: buildImagesCreate(input.images) },
  variants: { create: buildVariantsCreate(input.variants) },
});
