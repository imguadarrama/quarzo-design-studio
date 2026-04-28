import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { serializeProductPublic, type ProductWithRelations } from "../lib/serializers.js";

export const productsRouter = Router();

productsRouter.get("/products", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        images: true,
        variants: { include: { options: true } },
      },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    res.json({
      products: products.map((product: ProductWithRelations) => serializeProductPublic(product)),
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/products/:slug", async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: {
        slug: req.params.slug,
        active: true,
      },
      include: {
        images: true,
        variants: { include: { options: true } },
      },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({
      product: serializeProductPublic(product as ProductWithRelations),
    });
  } catch (err) {
    next(err);
  }
});
