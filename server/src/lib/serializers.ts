import { Prisma } from "@prisma/client";

export const productInclude = {
  images: true,
  variants: {
    include: {
      options: {
        include: {
          palette: { include: { swatches: { where: { active: true } } } },
        },
      },
    },
  },
  designs: { include: { variants: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type VariantRecord = ProductWithRelations["variants"][number];
type VariantOptionRecord = VariantRecord["options"][number];
type DesignRecord = ProductWithRelations["designs"][number];

export const paletteInclude = {
  swatches: true,
} satisfies Prisma.OptionPaletteInclude;

export type PaletteWithRelations = Prisma.OptionPaletteGetPayload<{
  include: typeof paletteInclude;
}>;

type SwatchRecord = PaletteWithRelations["swatches"][number];

const moneyToNumber = (value: Prisma.Decimal): number => Number(value);

const sortByPosition = <T extends { position: number }>(items: readonly T[]): T[] =>
  items.slice().sort((a, b) => a.position - b.position);

const optionValues = (option: VariantOptionRecord): string[] | null =>
  option.type === "SELECT" ? ((option.values as string[] | null) ?? []) : null;

const serializeSwatchPublic = (swatch: SwatchRecord) => ({
  id: swatch.id,
  name: swatch.name,
  imageUrl: swatch.imageUrl,
  position: swatch.position,
});

const serializeOptionPublic = (option: VariantOptionRecord) => {
  const base = {
    id: option.id,
    name: option.name,
    type: option.type,
    required: option.required,
  };
  if (option.type === "SELECT") {
    return { ...base, values: optionValues(option) };
  }
  if (option.type === "SWATCH" && option.palette) {
    return {
      ...base,
      palette: {
        id: option.palette.id,
        name: option.palette.name,
        slug: option.palette.slug,
        swatches: sortByPosition(option.palette.swatches).map(serializeSwatchPublic),
      },
    };
  }
  return base;
};

const serializeVariantPublic = (variant: VariantRecord) => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: moneyToNumber(variant.price),
  options: sortByPosition(variant.options).map(serializeOptionPublic),
});

const serializeDesignPublic = (design: DesignRecord) => ({
  id: design.id,
  name: design.name,
  imageUrl: design.imageUrl,
  position: design.position,
  compatibleVariantIds: design.variants.map((dv) => dv.variantId),
});

export const serializeProductPublic = (product: ProductWithRelations) => ({
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
  variants: sortByPosition(product.variants).map(serializeVariantPublic),
  designs: sortByPosition(product.designs)
    .filter((d) => d.active)
    .map(serializeDesignPublic),
});

const serializeOptionAdmin = (option: VariantOptionRecord) => {
  const base = {
    id: option.id,
    name: option.name,
    type: option.type,
    required: option.required,
    position: option.position,
  };
  if (option.type === "SELECT") {
    return { ...base, values: optionValues(option), paletteId: null as string | null };
  }
  if (option.type === "SWATCH") {
    return { ...base, values: null as string[] | null, paletteId: option.paletteId };
  }
  return { ...base, values: null as string[] | null, paletteId: null as string | null };
};

const serializeVariantAdmin = (variant: VariantRecord) => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: moneyToNumber(variant.price),
  position: variant.position,
  options: sortByPosition(variant.options).map(serializeOptionAdmin),
});

const serializeDesignAdmin = (design: DesignRecord) => ({
  id: design.id,
  name: design.name,
  imageUrl: design.imageUrl,
  position: design.position,
  active: design.active,
  compatibleVariantIds: design.variants.map((dv) => dv.variantId),
});

export const serializeProductAdmin = (product: ProductWithRelations) => ({
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
  variants: sortByPosition(product.variants).map(serializeVariantAdmin),
  designs: sortByPosition(product.designs).map(serializeDesignAdmin),
});

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
