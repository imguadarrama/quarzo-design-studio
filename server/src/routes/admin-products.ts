import type { VariantKind } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { productInclude, serializeProductAdmin } from "../lib/serializers.js";
import { productSchema } from "../lib/validation-schemas.js";
import {
  buildImagesCreate,
  buildProductDesignsCreate,
  buildProductMetadata,
  buildVariantPricesCreate,
  type ExistingSkuByKind,
} from "../lib/product-write.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { deleteImageKeys, extractKeyFromUrl } from "../lib/storage.js";

export const adminProductsRouter = Router();

adminProductsRouter.use(authenticateAdmin, requireAdmin);

adminProductsRouter.get("/products", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: productInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    res.json({ products: products.map(serializeProductAdmin) });
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

    if (!product) throw new NotFoundError("Product not found");

    res.json({ product: serializeProductAdmin(product) });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.post("/products", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    const product = await prisma.$transaction(async (tx) => {
      const aliasConflict = await tx.productSlugAlias.findFirst({
        where: { slug: data.slug },
        select: { productId: true },
      });
      if (aliasConflict) {
        throw new ConflictError(
          "SLUG_ALIAS_CONFLICT",
          "Este slug pertenece al historial de otro producto. Elige otro.",
        );
      }

      const created = await tx.product.create({
        data: {
          ...buildProductMetadata(data),
          images: { create: buildImagesCreate(data.images) },
          designs: { create: buildProductDesignsCreate(data.designIds) },
        },
      });

      // Variants land in a second step because the SKU generator needs the
      // committed product slug + an open transaction to scan for uniqueness.
      const variantRows = await buildVariantPricesCreate(tx, created.slug, data.variants);
      await tx.productVariantPrice.createMany({
        data: variantRows.map((r) => ({ ...r, productId: created.id })),
      });

      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: productInclude,
      });
    });

    res.status(201).json({ product: serializeProductAdmin(product) });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.patch("/products/:id", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        variants: { select: { kind: true, sku: true } },
      },
    });

    if (!existing) throw new NotFoundError("Product not found");

    // Preserve each kind's 4-char SKU suffix across slug edits so inventory
    // codes stay stable (Golden Rule of inventory immutability).
    const existingByKind: ExistingSkuByKind = new Map<VariantKind, string>(
      existing.variants.map((v) => [v.kind, v.sku] as const),
    );

    const product = await prisma.$transaction(async (tx) => {
      // All slug-alias machinery runs first: (1) Postgres aborts the whole
      // transaction on any constraint failure, so we have to detect collisions
      // up front rather than try/catch around a Prisma create; (2) failing
      // here costs nothing — running it after the destructive deletes would
      // still roll back, but burns writes.
      if (data.slug !== existing.slug) {
        const newSlugConflict = await tx.productSlugAlias.findFirst({
          where: { slug: data.slug, productId: { not: req.params.id } },
          select: { productId: true },
        });
        if (newSlugConflict) {
          throw new ConflictError(
            "SLUG_ALIAS_CONFLICT",
            "Este slug pertenece al historial de otro producto. Elige otro.",
          );
        }

        const ownerOfOldSlugAlias = await tx.productSlugAlias.findUnique({
          where: { slug: existing.slug },
          select: { productId: true },
        });
        if (
          ownerOfOldSlugAlias &&
          ownerOfOldSlugAlias.productId !== req.params.id
        ) {
          // Inconsistent legacy data: another product already aliased to our
          // current slug. Unreachable once newSlugConflict is in place, but
          // refuse loudly rather than corrupt the chain further.
          throw new ConflictError(
            "SLUG_ALIAS_CONFLICT",
            "Conflicto con el historial de otro producto. Contacta al administrador.",
          );
        }
        if (!ownerOfOldSlugAlias) {
          await tx.productSlugAlias.create({
            data: { productId: req.params.id, slug: existing.slug },
          });
        }
        // Recycle: if reverting to a slug we previously aliased, free our row
        // so the Product can take the slug back.
        await tx.productSlugAlias.deleteMany({
          where: { productId: req.params.id, slug: data.slug },
        });
      }

      // PATCH full-replaces variant prices, images, and design joins. Old
      // image R2 keys orphan here (same swap-time tradeoff as Phase 2.6 §7.1).
      // Designs are global; their images stay.
      await tx.productVariantPrice.deleteMany({ where: { productId: req.params.id } });
      await tx.productImage.deleteMany({ where: { productId: req.params.id } });
      await tx.productDesign.deleteMany({ where: { productId: req.params.id } });

      await tx.product.update({
        where: { id: req.params.id },
        data: {
          ...buildProductMetadata(data),
          images: { create: buildImagesCreate(data.images) },
          designs: { create: buildProductDesignsCreate(data.designIds) },
        },
      });

      const variantRows = await buildVariantPricesCreate(
        tx,
        data.slug,
        data.variants,
        existingByKind,
      );
      await tx.productVariantPrice.createMany({
        data: variantRows.map((r) => ({ ...r, productId: req.params.id })),
      });

      return tx.product.findUniqueOrThrow({
        where: { id: req.params.id },
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
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, images: { select: { url: true } } },
    });

    if (!existing) throw new NotFoundError("Product not found");

    await prisma.product.delete({ where: { id: req.params.id } });

    // Designs are global; don't sweep their R2 keys here.
    const keys = existing.images
      .map((img) => extractKeyFromUrl(img.url))
      .filter((k): k is string => k !== null);
    if (keys.length > 0) {
      const { failed } = await deleteImageKeys(keys);
      if (failed.length > 0) {
        console.warn("[r2] orphaned keys after product delete", {
          productId: existing.id,
          failed,
        });
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
