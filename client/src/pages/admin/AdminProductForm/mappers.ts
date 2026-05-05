import type {
  AdminProduct,
  ProductImagePayload,
  ProductPayload,
  ProductVariantOptionPayload,
  ProductVariantPayload,
} from "@/lib/types";
import type {
  ProductFormImage,
  ProductFormValues,
  ProductFormVariant,
} from "./schema.js";

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
        values: option.values ?? undefined,
        required: option.required,
      })),
    })),
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
    options: variant.options.map((option) => {
      const payload: ProductVariantOptionPayload = {
        name: option.name,
        type: option.type,
        required: option.required,
      };
      if (option.type === "SELECT" && option.values) {
        payload.values = option.values;
      }
      return payload;
    }),
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
  };
}
