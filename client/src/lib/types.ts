export type AdminUser = {
  id: string;
  email: string;
};

export type VariantOptionType = "SELECT" | "SWATCH" | "TEXT";

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
};

export type OptionSwatch = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
};

export type OptionPalette = {
  id: string;
  name: string;
  slug: string;
  swatches: OptionSwatch[];
};

export type ProductVariantOption =
  | { id: string; name: string; required: boolean; type: "TEXT" }
  | { id: string; name: string; required: boolean; type: "SELECT"; values: string[] }
  | { id: string; name: string; required: boolean; type: "SWATCH"; palette: OptionPalette };

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  options: ProductVariantOption[];
};

export type ProductDesign = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
  compatibleVariantIds: string[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  images: ProductImage[];
  variants: ProductVariant[];
  designs: ProductDesign[];
};

export type AdminProductImage = ProductImage & {
  position: number;
};

type AdminProductVariantOptionBase = {
  id: string;
  name: string;
  required: boolean;
  position: number;
};

export type AdminProductVariantOption =
  | (AdminProductVariantOptionBase & { type: "TEXT"; values: null; paletteId: null })
  | (AdminProductVariantOptionBase & { type: "SELECT"; values: string[]; paletteId: null })
  | (AdminProductVariantOptionBase & { type: "SWATCH"; values: null; paletteId: string });

export type AdminProductVariant = Omit<ProductVariant, "options"> & {
  position: number;
  options: AdminProductVariantOption[];
};

export type AdminProductDesign = ProductDesign & {
  active: boolean;
};

export type AdminProduct = Omit<Product, "images" | "variants" | "designs"> & {
  active: boolean;
  createdAt: string;
  images: AdminProductImage[];
  variants: AdminProductVariant[];
  designs: AdminProductDesign[];
};

export type ProductImagePayload = {
  url: string;
  alt?: string;
};

export type ProductVariantOptionPayload =
  | { name: string; required?: boolean; type: "TEXT" }
  | { name: string; required?: boolean; type: "SELECT"; values: string[] }
  | { name: string; required?: boolean; type: "SWATCH"; paletteId: string };

export type ProductVariantPayload = {
  name: string;
  sku: string;
  price: number;
  options: ProductVariantOptionPayload[];
};

export type ProductDesignPayload = {
  name: string;
  imageUrl: string;
  active: boolean;
  compatibleVariantIndices: number[];
};

export type ProductPayload = {
  slug: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  images: ProductImagePayload[];
  variants: ProductVariantPayload[];
  designs: ProductDesignPayload[];
};

export type AdminOptionSwatch = OptionSwatch & {
  active: boolean;
};

export type AdminOptionPalette = {
  id: string;
  name: string;
  slug: string;
  position: number;
  active: boolean;
  swatches: AdminOptionSwatch[];
};

export type OptionSwatchPayload = {
  name: string;
  imageUrl: string;
  active: boolean;
};

export type PalettePayload = {
  name: string;
  slug: string;
  active: boolean;
  swatches: OptionSwatchPayload[];
};
