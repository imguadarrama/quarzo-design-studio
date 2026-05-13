import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, VariantKind } from "@prisma/client";
import type { ProductInput } from "./validation-schemas.js";
import { ensureUniqueSku, extractSkuSuffix } from "./sku-generator.js";

export type ExistingSkuByKind = Map<VariantKind, string>;

// Generates rows ready for `tx.productVariantPrice.createMany`. The SKU is
// auto-derived from the product slug; on PATCH, callers pass `existingByKind`
// so each `(productId, kind)` row keeps its 4-char suffix across slug edits —
// preserving the Golden Rule of inventory stability.
export const buildVariantPricesCreate = async (
  tx: Prisma.TransactionClient,
  productSlug: string,
  prices: ProductInput["variants"],
  existingByKind?: ExistingSkuByKind,
) => {
  const rows: {
    kind: VariantKind;
    price: Decimal;
    sku: string;
    offered: boolean;
  }[] = [];
  for (const p of prices) {
    const preferredSuffix = existingByKind
      ? extractSkuSuffix(existingByKind.get(p.kind) ?? "") ?? undefined
      : undefined;
    const sku = await ensureUniqueSku(tx, productSlug, p.kind, preferredSuffix);
    rows.push({
      kind: p.kind,
      price: new Decimal(p.price.toFixed(2)),
      sku,
      offered: p.offered,
    });
  }
  return rows;
};

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
  categoryId: input.categoryId,
  active: input.active,
});

export const buildProductDesignsCreate = (designIds: string[]) =>
  designIds.map((designId) => ({ designId }));
