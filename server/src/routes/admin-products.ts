import { Router } from "express";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const imageUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.startsWith("data:image/") || /^https?:\/\//.test(value),
    "Image must be a data URL or an http/https URL",
  );

const variantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(80),
  priceDelta: z.coerce.number().min(0).max(999999),
  stock: z.coerce.number().int().min(0).max(999999),
});

const imageSchema = z.object({
  url: imageUrlSchema,
  alt: z.string().trim().max(160).optional().or(z.literal("")),
});

const productSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(80),
  basePrice: z.coerce.number().min(0).max(999999),
  active: z.coerce.boolean().default(true),
  images: z.array(imageSchema).min(1).max(8),
  variants: z.array(variantSchema).min(1).max(12),
});

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

const moneyToNumber = (value: Decimal): number => Number(value);

const serializeProduct = (product: ProductWithRelations) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  category: product.category,
  basePrice: moneyToNumber(product.basePrice),
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
});

const buildProductWriteInput = (input: z.infer<typeof productSchema>) => ({
  slug: input.slug,
  name: input.name,
  description: input.description,
  category: input.category,
  basePrice: new Decimal(input.basePrice.toFixed(2)),
  active: input.active,
  images: {
    create: input.images.map((image, index) => ({
      url: image.url,
      alt: image.alt || null,
      position: index,
    })),
  },
  variants: {
    create: input.variants.map((variant) => ({
      name: variant.name,
      sku: variant.sku,
      priceDelta: new Decimal(variant.priceDelta.toFixed(2)),
      stock: variant.stock,
    })),
  },
});

const isUniqueConstraintError = (error: unknown): error is { code: string } =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export const adminProductsRouter = Router();

adminProductsRouter.use(authenticateAdmin, requireAdmin);

adminProductsRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    include: {
      images: true,
      variants: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  res.json({
    products: products.map((product: ProductWithRelations) => serializeProduct(product)),
  });
});

adminProductsRouter.get("/products/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      images: true,
      variants: true,
    },
  });

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ product: serializeProduct(product as ProductWithRelations) });
});

adminProductsRouter.post("/products", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const product = await prisma.product.create({
      data: buildProductWriteInput(parsed.data),
      include: {
        images: true,
        variants: true,
      },
    });

    res.status(201).json({ product: serializeProduct(product as ProductWithRelations) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: "Slug or SKU already exists" });
      return;
    }

    throw error;
  }
});

adminProductsRouter.patch("/products/:id", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!existingProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category,
        basePrice: new Decimal(parsed.data.basePrice.toFixed(2)),
        active: parsed.data.active,
        images: {
          deleteMany: {},
          create: parsed.data.images.map((image, index) => ({
            url: image.url,
            alt: image.alt || null,
            position: index,
          })),
        },
        variants: {
          deleteMany: {},
          create: parsed.data.variants.map((variant) => ({
            name: variant.name,
            sku: variant.sku,
            priceDelta: new Decimal(variant.priceDelta.toFixed(2)),
            stock: variant.stock,
          })),
        },
      },
      include: {
        images: true,
        variants: true,
      },
    });

    res.json({ product: serializeProduct(product as ProductWithRelations) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: "Slug or SKU already exists" });
      return;
    }

    throw error;
  }
});

adminProductsRouter.delete("/products/:id", async (req, res) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!existingProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await prisma.product.delete({
    where: { id: req.params.id },
  });

  res.status(204).send();
});
