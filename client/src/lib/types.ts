export type AdminUser = {
  id: string;
  email: string;
};

export type VariantKind =
  | "CON_FOIL"
  | "CON_TINTA_NORMAL"
  | "CON_FOIL_Y_TINTA"
  | "PAPEL_TEXTURIZADO";

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

export type ProductVariantPrice = {
  kind: VariantKind;
  displayName: string;
  sku: string | null;
  price: number | null;
  palette: OptionPalette | null;
};

export type Design = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
  compatibleKinds: VariantKind[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  images: ProductImage[];
  variants: ProductVariantPrice[];
  designs: Design[];
};

export type AdminProductImage = ProductImage & {
  position: number;
};

export type AdminProductVariantPrice = {
  kind: VariantKind;
  displayName: string;
  sku: string;
  price: number;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  createdAt: string;
  images: AdminProductImage[];
  variants: AdminProductVariantPrice[];
  designIds: string[];
};

export type AdminDesign = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
  active: boolean;
  createdAt: string;
  compatibleKinds: VariantKind[];
};

export type ProductImagePayload = {
  url: string;
  alt?: string;
};

export type ProductVariantPricePayload = {
  kind: VariantKind;
  sku: string;
  price: number;
};

export type ProductPayload = {
  slug: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  images: ProductImagePayload[];
  variants: ProductVariantPricePayload[];
  designIds: string[];
};

export type DesignPayload = {
  name: string;
  imageUrl: string;
  active: boolean;
  compatibleKinds: VariantKind[];
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
