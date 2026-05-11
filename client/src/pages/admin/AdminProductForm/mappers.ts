import type {
  AdminProduct,
  AdminProductDesign,
  AdminProductVariant,
  ProductDesignPayload,
  ProductImagePayload,
  ProductPayload,
  ProductVariantOptionPayload,
  ProductVariantPayload,
} from "@/lib/types";
import type {
  ProductFormDesign,
  ProductFormImage,
  ProductFormValues,
  ProductFormVariant,
} from "./schema.js";

function designToFormValue(
  design: AdminProductDesign,
  variants: AdminProductVariant[],
): ProductFormDesign {
  const indexById = new Map(variants.map((v, i) => [v.id, i] as const));
  const compatibleVariantIndices = design.compatibleVariantIds
    .map((id) => indexById.get(id))
    .filter((idx): idx is number => idx !== undefined);
  return {
    name: design.name,
    imageUrl: design.imageUrl,
    active: design.active,
    compatibleVariantIndices,
  };
}

export function productToFormValues(product: AdminProduct): ProductFormValues {
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
    variants: product.variants.map((variant) => ({
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      options: variant.options.map((option) => ({
        name: option.name,
        type: option.type,
        values: option.type === "SELECT" ? option.values : undefined,
        paletteId: option.type === "SWATCH" ? option.paletteId : undefined,
        required: option.required,
      })),
    })),
    designs: product.designs.map((d) => designToFormValue(d, product.variants)),
  };
}

function imageToPayload(image: ProductFormImage): ProductImagePayload {
  const alt = image.alt?.trim();
  return alt ? { url: image.url, alt } : { url: image.url };
}

function variantToPayload(variant: ProductFormVariant): ProductVariantPayload {
  return {
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    options: variant.options.map((option): ProductVariantOptionPayload => {
      if (option.type === "SELECT") {
        return {
          name: option.name,
          type: "SELECT",
          values: option.values ?? [],
          required: option.required,
        };
      }
      if (option.type === "SWATCH") {
        return {
          name: option.name,
          type: "SWATCH",
          paletteId: option.paletteId!,
          required: option.required,
        };
      }
      return { name: option.name, type: "TEXT", required: option.required };
    }),
  };
}

function designToPayload(design: ProductFormDesign): ProductDesignPayload {
  return {
    name: design.name,
    imageUrl: design.imageUrl,
    active: design.active,
    compatibleVariantIndices: design.compatibleVariantIndices,
  };
}

export function formValuesToPayload(values: ProductFormValues): ProductPayload {
  return {
    slug: values.slug,
    name: values.name,
    description: values.description,
    category: values.category,
    active: values.active,
    images: values.images.map(imageToPayload),
    variants: values.variants.map(variantToPayload),
    designs: values.designs.map(designToPayload),
  };
}
