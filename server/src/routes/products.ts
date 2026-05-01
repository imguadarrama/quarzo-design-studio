import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { productInclude, serializeProductPublic } from "../lib/serializers.js";
import { NotFoundError } from "../lib/errors.js";

export const productsRouter = Router();

productsRouter.get("/products", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: productInclude,
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    res.json({
      products: products.map(serializeProductPublic),
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
      include: productInclude,
    });

    if (!product) throw new NotFoundError("Product not found");

    res.json({
      product: serializeProductPublic(product),
    });
  } catch (err) {
    next(err);
  }
});
