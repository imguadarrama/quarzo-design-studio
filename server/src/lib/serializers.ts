import { Prisma } from "@prisma/client";

export const productInclude = {
  images: true,
  variants: { include: { options: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type VariantRecord = ProductWithRelations["variants"][number];
type VariantOptionRecord = VariantRecord["options"][number];

const moneyToNumber = (value: Prisma.Decimal): number => Number(value);

const sortByPosition = <T extends { position: number }>(items: readonly T[]): T[] =>
  items.slice().sort((a, b) => a.position - b.position);

const optionValues = (option: VariantOptionRecord): string[] | null =>
  option.type === "SELECT" ? ((option.values as string[] | null) ?? []) : null;

const serializeOptionPublic = (option: VariantOptionRecord) => ({
  id: option.id,
  name: option.name,
  type: option.type,
  values: optionValues(option),
});

const serializeVariantPublic = (variant: VariantRecord) => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: moneyToNumber(variant.price),
  options: sortByPosition(variant.options).map(serializeOptionPublic),
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
  variants: product.variants.map(serializeVariantPublic),
});

const serializeOptionAdmin = (option: VariantOptionRecord) => ({
  id: option.id,
  name: option.name,
  type: option.type,
  values: optionValues(option),
  required: option.required,
  position: option.position,
});

const serializeVariantAdmin = (variant: VariantRecord) => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: moneyToNumber(variant.price),
  options: sortByPosition(variant.options).map(serializeOptionAdmin),
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
  variants: product.variants.map(serializeVariantAdmin),
});
