import { Router } from "express";
import { Decimal } from "@prisma/client/runtime/library";
import { VariantOptionType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { productInclude, serializeProductAdmin } from "../lib/serializers.js";

const MAX_DATA_URL_BYTES = 500_000;

const imageUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.startsWith("data:image/") || /^https?:\/\//.test(value),
    "Image must be a data URL or an http/https URL",
  )
  .refine((value) => {
    if (!value.startsWith("data:image/")) return true;
    const b64 = value.split(",", 2)[1] ?? "";
    const bytes = Math.floor(b64.length * 0.75);
    return bytes <= MAX_DATA_URL_BYTES;
  }, "Imagen demasiado grande (máx 500 KB)");

const variantOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.nativeEnum(VariantOptionType),
    values: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    required: z.boolean().default(true),
  })
  .superRefine((opt, ctx) => {
    if (opt.type === VariantOptionType.SELECT) {
      if (!opt.values || opt.values.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["values"],
          message: "Las opciones de tipo SELECT requieren al menos un valor",
        });
      }
    }
  });

const variantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(80),
  price: z.coerce.number().min(0).max(999999),
  options: z.array(variantOptionSchema).max(8).default([]),
});

const imageSchema = z.object({
  url: imageUrlSchema,
  alt: z.string().trim().max(160).optional().or(z.literal("")),
});

const productSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens"),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
    category: z.string().trim().min(1).max(80),
    active: z.coerce.boolean().default(true),
    images: z.array(imageSchema).max(8, "Máximo 8 imágenes por producto").default([]),
    variants: z.array(variantSchema).max(12).default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.active) return;
    if (data.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["active"],
        message: "No se puede publicar sin imágenes",
      });
    }
    if (data.variants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["active"],
        message: "No se puede publicar sin variantes",
      });
    }
  });

type ProductInput = z.infer<typeof productSchema>;

const buildVariantsCreate = (variants: ProductInput["variants"]) =>
  variants.map((variant) => ({
    name: variant.name,
    sku: variant.sku,
    price: new Decimal(variant.price.toFixed(2)),
    options: {
      create: variant.options.map((option, index) => ({
        name: option.name,
        type: option.type,
        values:
          option.type === VariantOptionType.SELECT ? (option.values ?? []) : undefined,
        required: option.required,
        position: index,
      })),
    },
  }));

const buildProductWriteInput = (input: ProductInput) => ({
  slug: input.slug,
  name: input.name,
  description: input.description,
  category: input.category,
  active: input.active,
  images: {
    create: input.images.map((image, index) => ({
      url: image.url,
      alt: image.alt || null,
      position: index,
    })),
  },
  variants: {
    create: buildVariantsCreate(input.variants),
  },
});

export const adminProductsRouter = Router();

adminProductsRouter.use(authenticateAdmin, requireAdmin);

adminProductsRouter.get("/products", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: productInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    res.json({
      products: products.map(serializeProductAdmin),
    });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.get("/products/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: productInclude,
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ product: serializeProductAdmin(product) });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.post("/products", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: buildProductWriteInput(data),
      include: productInclude,
    });

    res.status(201).json({ product: serializeProductAdmin(product) });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.patch("/products/:id", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!existingProduct) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
      await tx.productImage.deleteMany({ where: { productId: req.params.id } });

      return tx.product.update({
        where: { id: req.params.id },
        data: {
          slug: data.slug,
          name: data.name,
          description: data.description,
          category: data.category,
          active: data.active,
          images: {
            create: data.images.map((image, index) => ({
              url: image.url,
              alt: image.alt || null,
              position: index,
            })),
          },
          variants: {
            create: buildVariantsCreate(data.variants),
          },
        },
        include: productInclude,
      });
    });

    res.json({ product: serializeProductAdmin(product) });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.delete("/products/:id", async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});
