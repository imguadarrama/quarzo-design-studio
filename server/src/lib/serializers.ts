import { Prisma, VariantKind } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { VARIANT_KIND_NAMES, VARIANT_KIND_ORDER } from "./variant-kinds.js";
import { VARIANT_PALETTE_SLUG } from "./variant-palettes.js";

export const productInclude = {
  images: true,
  variants: true,
  designs: { include: { design: { include: { compat: true } } } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type VariantPriceRecord = ProductWithRelations["variants"][number];
type ProductDesignRecord = ProductWithRelations["designs"][number];

export const paletteInclude = {
  swatches: true,
} satisfies Prisma.OptionPaletteInclude;

export type PaletteWithRelations = Prisma.OptionPaletteGetPayload<{
  include: typeof paletteInclude;
}>;

type SwatchRecord = PaletteWithRelations["swatches"][number];

export const designInclude = {
  compat: true,
} satisfies Prisma.DesignInclude;

export type DesignWithRelations = Prisma.DesignGetPayload<{
  include: typeof designInclude;
}>;

const moneyToNumber = (value: Prisma.Decimal): number => Number(value);

const sortByPosition = <T extends { position: number }>(items: readonly T[]): T[] =>
  items.slice().sort((a, b) => a.position - b.position);

const serializeSwatchPublic = (swatch: SwatchRecord) => ({
  id: swatch.id,
  name: swatch.name,
  imageUrl: swatch.imageUrl,
  position: swatch.position,
});

export type PaletteForVariant = {
  id: string;
  name: string;
  slug: string;
  swatches: ReturnType<typeof serializeSwatchPublic>[];
} | null;

export type PaletteMap = Map<VariantKind, PaletteForVariant>;

export const loadPaletteMap = async (prisma: PrismaClient): Promise<PaletteMap> => {
  const slugs = Array.from(
    new Set(
      Object.values(VARIANT_PALETTE_SLUG).filter((s): s is string => Boolean(s)),
    ),
  );
  const palettes = slugs.length
    ? await prisma.optionPalette.findMany({
        where: { slug: { in: slugs }, active: true },
        include: { swatches: { where: { active: true } } },
      })
    : [];
  const bySlug = new Map<string, PaletteForVariant>();
  for (const palette of palettes) {
    bySlug.set(palette.slug, {
      id: palette.id,
      name: palette.name,
      slug: palette.slug,
      swatches: sortByPosition(palette.swatches).map(serializeSwatchPublic),
    });
  }
  const result: PaletteMap = new Map();
  for (const kind of VARIANT_KIND_ORDER) {
    const slug = VARIANT_PALETTE_SLUG[kind];
    result.set(kind, slug ? (bySlug.get(slug) ?? null) : null);
  }
  return result;
};

const serializeVariantPricePublic = (
  price: VariantPriceRecord | undefined,
  kind: VariantKind,
  paletteMap: PaletteMap,
) => ({
  kind,
  displayName: VARIANT_KIND_NAMES[kind],
  sku: price?.sku ?? null,
  price: price ? moneyToNumber(price.price) : null,
  palette: paletteMap.get(kind) ?? null,
});

const designFromJoin = (pd: ProductDesignRecord) => pd.design;

const serializeDesignPublicFromProduct = (pd: ProductDesignRecord) => {
  const d = designFromJoin(pd);
  return {
    id: d.id,
    name: d.name,
    imageUrl: d.imageUrl,
    position: d.position,
    compatibleKinds: d.compat.map((c) => c.kind),
  };
};

export const serializeProductPublic = (
  product: ProductWithRelations,
  paletteMap: PaletteMap,
) => {
  const byKind = new Map<VariantKind, VariantPriceRecord>();
  for (const v of product.variants) byKind.set(v.kind, v);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    images: sortByPosition(product.images).map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
    })),
    variants: VARIANT_KIND_ORDER.map((kind) =>
      serializeVariantPricePublic(byKind.get(kind), kind, paletteMap),
    ),
    designs: product.designs
      .filter((pd) => pd.design.active)
      .map(serializeDesignPublicFromProduct)
      .sort((a, b) => a.position - b.position),
  };
};

const serializeVariantPriceAdmin = (
  price: VariantPriceRecord | undefined,
  kind: VariantKind,
) => ({
  kind,
  displayName: VARIANT_KIND_NAMES[kind],
  sku: price?.sku ?? "",
  price: price ? moneyToNumber(price.price) : 0,
});

export const serializeProductAdmin = (product: ProductWithRelations) => {
  const byKind = new Map<VariantKind, VariantPriceRecord>();
  for (const v of product.variants) byKind.set(v.kind, v);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    images: sortByPosition(product.images).map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      position: image.position,
    })),
    variants: VARIANT_KIND_ORDER.map((kind) =>
      serializeVariantPriceAdmin(byKind.get(kind), kind),
    ),
    designIds: product.designs.map((pd) => pd.designId),
  };
};

const serializeSwatchAdmin = (swatch: SwatchRecord) => ({
  id: swatch.id,
  name: swatch.name,
  imageUrl: swatch.imageUrl,
  position: swatch.position,
  active: swatch.active,
});

export const serializePaletteAdmin = (palette: PaletteWithRelations) => ({
  id: palette.id,
  name: palette.name,
  slug: palette.slug,
  position: palette.position,
  active: palette.active,
  swatches: sortByPosition(palette.swatches).map(serializeSwatchAdmin),
});

export const serializeDesignAdmin = (design: DesignWithRelations) => ({
  id: design.id,
  name: design.name,
  imageUrl: design.imageUrl,
  position: design.position,
  active: design.active,
  createdAt: design.createdAt.toISOString(),
  compatibleKinds: design.compat.map((c) => c.kind),
});

export const serializeDesignPublic = (design: DesignWithRelations) => ({
  id: design.id,
  name: design.name,
  imageUrl: design.imageUrl,
  position: design.position,
  compatibleKinds: design.compat.map((c) => c.kind),
});
