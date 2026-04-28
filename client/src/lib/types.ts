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

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  priceDelta: number;
  stock: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  startingPrice?: number;
  active: boolean;
  createdAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
};

export type ProductImagePayload = {
  url: string;
  alt?: string;
};

export type ProductVariantPayload = {
  name: string;
  sku: string;
  priceDelta: number;
  stock: number;
};

export type ProductPayload = {
  slug: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  active: boolean;
  images: ProductImagePayload[];
  variants: ProductVariantPayload[];
};
