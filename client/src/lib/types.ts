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

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type AdminCategory = Category & {
  position: number;
  active: boolean;
  createdAt: string;
};

export type CategoryPayload = {
  name: string;
  slug: string;
  active: boolean;
  position?: number;
};

export type ProductVariantPrice = {
  kind: VariantKind;
  displayName: string;
  sku: string;
  price: number;
  palette: OptionPalette | null;
};

export type Design = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
  compatibleKinds: VariantKind[];
  categoryIds: string[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
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
  offered: boolean;
};

export type ProductSlugAlias = {
  slug: string;
  createdAt: string;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  category: Category;
  active: boolean;
  createdAt: string;
  images: AdminProductImage[];
  variants: AdminProductVariantPrice[];
  designIds: string[];
  slugAliases: ProductSlugAlias[];
};

export type AdminDesign = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
  active: boolean;
  createdAt: string;
  compatibleKinds: VariantKind[];
  categoryIds: string[];
};

export type ProductImagePayload = {
  url: string;
  alt?: string;
};

export type ProductVariantPricePayload = {
  kind: VariantKind;
  price: number;
  offered: boolean;
};

export type ProductPayload = {
  slug: string;
  name: string;
  description: string;
  categoryId: string;
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
  categoryIds: string[];
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

export type ShippingMethod = "NACIONAL" | "PICKUP_SALTILLO";
export type PaymentMethod = "MERCADOPAGO" | "TRANSFERENCIA";
export type OrderStatus =
  | "PENDIENTE"
  | "PAGADO"
  | "ENVIADO"
  | "ENTREGADO"
  | "CANCELADO";

export type CartLine = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  productImageUrl: string;
  variantKind: VariantKind;
  variantName: string;
  unitPrice: number;
  quantity: number;
  designId: string;
  designName: string;
  designImageUrl: string;
  foilSwatchId: string | null;
  foilColorName: string | null;
  personalizationText: string;
};

export type ShippingAddress = {
  calle: string;
  numero: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  notas?: string;
};

export type OrderItemPublic = {
  productId: string;
  variantKind: VariantKind;
  sku: string;
  productName: string;
  variantName: string;
  unitPrice: string;
  quantity: number;
  personalizationText: string;
  selections: {
    foilColor?: string;
    foilSwatchId?: string;
    foilImageUrl?: string;
  };
  designId: string | null;
  designName: string | null;
  designImageUrl: string | null;
};

export type OrderPublic = {
  publicToken: string;
  status: OrderStatus;
  email: string;
  name: string;
  phone: string;
  shippingMethod: ShippingMethod;
  shippingAddress: ShippingAddress | null;
  shippingFee: string;
  subtotal: string;
  total: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  items: OrderItemPublic[];
};

export type CreateOrderItemPayload = {
  productId: string;
  variantKind: VariantKind;
  designId: string;
  foilSwatchId: string | null;
  personalizationText: string;
  quantity: number;
};

export type CreateOrderPayload = {
  clientToken: string;
  email: string;
  name: string;
  phone: string;
  shippingMethod: ShippingMethod;
  shippingAddress: ShippingAddress | null;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: CreateOrderItemPayload[];
};
