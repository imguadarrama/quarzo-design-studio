import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, VariantKind } from "@prisma/client";
import type { ProductInput } from "./validation-schemas.js";
import { ensureUniqueSku, extractSkuSuffix } from "./sku-generator.js";
import { ConflictError } from "./errors.js";

export type ExistingSkuByKind = Map<VariantKind, string>;

// Reject the write if any picked design lacks a DesignVariantCompat row
// matching at least one currently-offered variant kind. Catches the case
// where an admin attaches a design and then unchecks every variant the
// design supports — otherwise the product would ship referencing a design
// that no offered variant can render.
export const assertDesignsCompatibleWithOfferedVariants = async (
  tx: Prisma.TransactionClient,
  designIds: string[],
  variants: ProductInput["variants"],
) => {
  if (designIds.length === 0) return;
  const offeredKinds = new Set<VariantKind>(
    variants.filter((v) => v.offered).map((v) => v.kind),
  );
  if (offeredKinds.size === 0) return;

  const designs = await tx.design.findMany({
    where: { id: { in: designIds } },
    select: { id: true, name: true, compat: { select: { kind: true } } },
  });
  const byId = new Map(designs.map((d) => [d.id, d] as const));

  for (const designId of designIds) {
    const design = byId.get(designId);
    if (!design) {
      throw new ConflictError(
        "DESIGN_NOT_FOUND",
        "Un diseño seleccionado ya no existe. Recarga la página y vuelve a intentarlo.",
      );
    }
    const hasMatch = design.compat.some((c) => offeredKinds.has(c.kind));
    if (!hasMatch) {
      throw new ConflictError(
        "DESIGN_VARIANT_INCOMPATIBLE",
        `El diseño "${design.name}" no es compatible con ninguna de las variantes ofrecidas.`,
      );
    }
  }
};

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
