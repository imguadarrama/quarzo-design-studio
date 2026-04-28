export type AdminUser = {
  id: string;
  email: string;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

export type VariantOptionType = "SELECT" | "TEXT";

export type ProductVariantOption = {
  id: string;
  name: string;
  type: VariantOptionType;
  values: string[] | null;
  required: boolean;
  position: number;
};

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  options: ProductVariantOption[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  createdAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
};

export type ProductImagePayload = {
  url: string;
  alt?: string;
};

export type ProductVariantOptionPayload = {
  name: string;
  type: VariantOptionType;
  values?: string[];
  required?: boolean;
};

export type ProductVariantPayload = {
  name: string;
  sku: string;
  price: number;
  options: ProductVariantOptionPayload[];
};

export type ProductPayload = {
  slug: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  images: ProductImagePayload[];
  variants: ProductVariantPayload[];
};
