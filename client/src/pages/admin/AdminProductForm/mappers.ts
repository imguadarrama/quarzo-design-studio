import type {
  AdminProduct,
  ProductImagePayload,
  ProductPayload,
  VariantKind,
} from "@/lib/types";
import type {
  ProductFormImage,
  ProductFormValues,
  ProductFormVariantPrice,
} from "./schema.js";

const VARIANT_KIND_ORDER: VariantKind[] = [
  "CON_FOIL",
  "CON_TINTA_NORMAL",
  "CON_FOIL_Y_TINTA",
  "PAPEL_TEXTURIZADO",
];

export const emptyVariantPrices = (): ProductFormVariantPrice[] =>
  VARIANT_KIND_ORDER.map((kind) => ({ kind, sku: "", price: 0 }));

export function productToFormValues(product: AdminProduct): ProductFormValues {
  const byKind = new Map(product.variants.map((v) => [v.kind, v]));
  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    description: product.description,
    active: product.active,
    images: product.images.map((img) => ({
      url: img.url,
      alt: img.alt ?? "",
    })),
    variants: VARIANT_KIND_ORDER.map((kind) => {
      const v = byKind.get(kind);
      return v
        ? { kind, sku: v.sku, price: v.price }
        : { kind, sku: "", price: 0 };
    }),
    designIds: product.designIds,
  };
}

function imageToPayload(image: ProductFormImage): ProductImagePayload {
  const alt = image.alt?.trim();
  return alt ? { url: image.url, alt } : { url: image.url };
}

export function formValuesToPayload(values: ProductFormValues): ProductPayload {
  return {
    slug: values.slug,
    name: values.name,
    description: values.description,
    category: values.category,
    active: values.active,
    images: values.images.map(imageToPayload),
    variants: values.variants.map((v) => ({
      kind: v.kind,
      sku: v.sku,
      price: v.price,
    })),
    designIds: values.designIds,
  };
}
