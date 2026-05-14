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
        orderBy: [{ createdAt: "desc" }],
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
    const requestedSlug = req.params.slug;
    const [paletteMap, product] = await Promise.all([
      loadPaletteMap(prisma),
      (async () => {
        const direct = await prisma.product.findFirst({
          where: { slug: requestedSlug, active: true },
          include: productInclude,
        });
        if (direct) return direct;
        // Slug-alias fallback for old URLs after a rename. The serializer
        // returns the canonical current slug; the SPA reads it from
        // payload.product.slug and does navigate(canonical, { replace: true }).
        const alias = await prisma.productSlugAlias.findUnique({
          where: { slug: requestedSlug },
          select: { productId: true },
        });
        if (!alias) return null;
        return prisma.product.findFirst({
          where: { id: alias.productId, active: true },
          include: productInclude,
        });
      })(),
    ]);

    if (!product) throw new NotFoundError("Product not found");

    res.json({
      product: serializeProductPublic(product, paletteMap),
    });
  } catch (err) {
    next(err);
  }
});
