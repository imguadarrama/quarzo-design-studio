import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { loadPaletteMap, productInclude, serializeProductPublic } from "../lib/serializers.js";
import { NotFoundError } from "../lib/errors.js";

export const productsRouter = Router();

productsRouter.get("/products", async (_req, res, next) => {
  try {
    const [products, paletteMap] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        include: productInclude,
        orderBy: [{ category: "asc" }, { createdAt: "desc" }],
      }),
      loadPaletteMap(prisma),
    ]);

    res.json({
      products: products.map((p) => serializeProductPublic(p, paletteMap)),
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/products/:slug", async (req, res, next) => {
  try {
    const [product, paletteMap] = await Promise.all([
      prisma.product.findFirst({
        where: {
          slug: req.params.slug,
          active: true,
        },
        include: productInclude,
      }),
      loadPaletteMap(prisma),
    ]);

    if (!product) throw new NotFoundError("Product not found");

    res.json({
      product: serializeProductPublic(product, paletteMap),
    });
  } catch (err) {
    next(err);
  }
});
