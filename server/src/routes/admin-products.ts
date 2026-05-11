import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { productInclude, serializeProductAdmin } from "../lib/serializers.js";
import { productSchema } from "../lib/validation-schemas.js";
import {
  buildDesignCompatCreate,
  buildImagesCreate,
  buildProductMetadata,
  buildVariantWriteInput,
} from "../lib/product-write.js";
import { NotFoundError } from "../lib/errors.js";
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
      const created = await tx.product.create({
        data: {
          ...buildProductMetadata(data),
          images: { create: buildImagesCreate(data.images) },
        },
      });

      const createdVariants = await Promise.all(
        data.variants.map((variant, index) =>
          tx.productVariant.create({
            data: { productId: created.id, ...buildVariantWriteInput(variant, index) },
            select: { id: true },
          }),
        ),
      );
      const variantIds = createdVariants.map((v) => v.id);

      await Promise.all(
        data.designs.map((design, index) =>
          tx.productDesign.create({
            data: {
              productId: created.id,
              name: design.name,
              imageUrl: design.imageUrl,
              active: design.active,
              position: index,
              variants: {
                create: buildDesignCompatCreate(design.compatibleVariantIndices, variantIds),
              },
            },
          }),
        ),
      );

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
      select: { id: true },
    });

    if (!existing) throw new NotFoundError("Product not found");

    const product = await prisma.$transaction(async (tx) => {
      // PATCH full-replaces variants, images, and designs. Old R2 keys for
      // images and designs orphan here (future-janitor problem, same swap-time
      // tradeoff as Phase 2.6 §7.1).
      await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
      await tx.productImage.deleteMany({ where: { productId: req.params.id } });
      await tx.productDesign.deleteMany({ where: { productId: req.params.id } });

      await tx.product.update({
        where: { id: req.params.id },
        data: {
          ...buildProductMetadata(data),
          images: { create: buildImagesCreate(data.images) },
        },
      });

      const createdVariants = await Promise.all(
        data.variants.map((variant, index) =>
          tx.productVariant.create({
            data: { productId: req.params.id, ...buildVariantWriteInput(variant, index) },
            select: { id: true },
          }),
        ),
      );
      const variantIds = createdVariants.map((v) => v.id);

      await Promise.all(
        data.designs.map((design, index) =>
          tx.productDesign.create({
            data: {
              productId: req.params.id,
              name: design.name,
              imageUrl: design.imageUrl,
              active: design.active,
              position: index,
              variants: {
                create: buildDesignCompatCreate(design.compatibleVariantIndices, variantIds),
              },
            },
          }),
        ),
      );

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

    // R2 cleanup is best-effort. The DB row is already gone; any keys we
    // fail to purge become orphans that a future janitor (Phase 7) will
    // sweep. Better to leak a few hundred KB than to fail the operator's
    // delete because of a transient storage hiccup.
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
