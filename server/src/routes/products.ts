import { Router } from "express";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db/prisma.js";

const moneyToNumber = (value: Decimal): number => Number(value);

type ProductImageRecord = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

type ProductVariantRecord = {
  id: string;
  name: string;
  sku: string;
  priceDelta: Decimal;
  stock: number;
};

type ProductWithRelations = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  basePrice: Decimal;
  active: boolean;
  createdAt: Date;
  images: ProductImageRecord[];
  variants: ProductVariantRecord[];
};

const serializeProduct = (product: ProductWithRelations) => {
  const variantPrices = product.variants.map((variant) => moneyToNumber(variant.priceDelta));
  const minVariantDelta = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    basePrice: moneyToNumber(product.basePrice),
    startingPrice: moneyToNumber(product.basePrice) + minVariantDelta,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    images: product.images
      .sort((left, right) => left.position - right.position)
      .map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        position: image.position,
      })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      priceDelta: moneyToNumber(variant.priceDelta),
      stock: variant.stock,
    })),
  };
};

export const productsRouter = Router();

productsRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      images: true,
      variants: true,
    },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });

  res.json({
    products: products.map((product: ProductWithRelations) => serializeProduct(product)),
  });
});

productsRouter.get("/products/:slug", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: {
      slug: req.params.slug,
      active: true,
    },
    include: {
      images: true,
      variants: true,
    },
  });

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    product: serializeProduct(product as ProductWithRelations),
  });
});
