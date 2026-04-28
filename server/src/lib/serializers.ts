import type { Decimal } from "@prisma/client/runtime/library";
import type { VariantOptionType } from "@prisma/client";

type ProductImageRecord = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

type ProductVariantOptionRecord = {
  id: string;
  name: string;
  type: VariantOptionType;
  values: unknown;
  required: boolean;
  position: number;
};

type ProductVariantRecord = {
  id: string;
  name: string;
  sku: string;
  price: Decimal;
  options: ProductVariantOptionRecord[];
};

export type ProductWithRelations = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  createdAt: Date;
  images: ProductImageRecord[];
  variants: ProductVariantRecord[];
};

const moneyToNumber = (value: Decimal): number => Number(value);

const serializeOption = (option: ProductVariantOptionRecord) => ({
  id: option.id,
  name: option.name,
  type: option.type,
  values: option.type === "SELECT" ? ((option.values as string[] | null) ?? []) : null,
  required: option.required,
  position: option.position,
});

const serializeVariant = (variant: ProductVariantRecord) => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: moneyToNumber(variant.price),
  options: variant.options
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(serializeOption),
});

export const serializeProduct = (product: ProductWithRelations) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  category: product.category,
  active: product.active,
  createdAt: product.createdAt.toISOString(),
  images: product.images
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      position: image.position,
    })),
  variants: product.variants.map(serializeVariant),
});
