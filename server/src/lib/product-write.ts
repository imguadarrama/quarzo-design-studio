import { Decimal } from "@prisma/client/runtime/library";
import type { ProductInput } from "./validation-schemas.js";

export const buildVariantPricesCreate = (
  prices: ProductInput["variants"],
) =>
  prices.map((p) => ({
    kind: p.kind,
    price: new Decimal(p.price.toFixed(2)),
    sku: p.sku,
  }));

export const buildImagesCreate = (images: ProductInput["images"]) =>
  images.map((image, index) => ({
    url: image.url,
    alt: image.alt || null,
    position: index,
  }));

export const buildProductMetadata = (input: ProductInput) => ({
  slug: input.slug,
  name: input.name,
  description: input.description,
  category: input.category,
  active: input.active,
});

export const buildProductDesignsCreate = (designIds: string[]) =>
  designIds.map((designId) => ({ designId }));
