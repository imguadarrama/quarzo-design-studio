import type {
  AdminProductImage,
  AdminProductVariant,
  ProductImagePayload,
  ProductVariantOptionPayload,
  ProductVariantPayload,
} from "../../../lib/types.js";

export function imageToPayload(img: AdminProductImage): ProductImagePayload {
  return img.alt ? { url: img.url, alt: img.alt } : { url: img.url };
}

export function variantToPayload(
  variant: AdminProductVariant,
): ProductVariantPayload {
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
      if (option.values) {
        payload.values = option.values;
      }
      return payload;
    }),
  };
}
