import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  designInclude,
  serializeDesignAdmin,
} from "../lib/serializers.js";
import { designSchema } from "../lib/validation-schemas.js";
import {
  buildDesignCategoriesCreate,
  buildDesignCompatRows,
  buildDesignMetadata,
} from "../lib/design-write.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { deleteImageKeys, extractKeyFromUrl } from "../lib/storage.js";

export const adminDesignsRouter = Router();

adminDesignsRouter.use(authenticateAdmin, requireAdmin);

adminDesignsRouter.get("/designs", async (_req, res, next) => {
  try {
    const designs = await prisma.design.findMany({
      include: designInclude,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
    res.json({ designs: designs.map(serializeDesignAdmin) });
  } catch (err) {
    next(err);
  }
});

adminDesignsRouter.get("/designs/:id", async (req, res, next) => {
  try {
    const design = await prisma.design.findUnique({
      where: { id: req.params.id },
      include: designInclude,
    });
    if (!design) throw new NotFoundError("Design not found");
    res.json({ design: serializeDesignAdmin(design) });
  } catch (err) {
    next(err);
  }
});

adminDesignsRouter.post("/designs", async (req, res, next) => {
  try {
    const data = designSchema.parse(req.body);

    const design = await prisma.design.create({
      data: {
        ...buildDesignMetadata(data),
        compat: { create: buildDesignCompatRows(data.compatibleKinds) },
        categories: { create: buildDesignCategoriesCreate(data.categoryIds) },
      },
      include: designInclude,
    });

    res.status(201).json({ design: serializeDesignAdmin(design) });
  } catch (err) {
    next(err);
  }
});

adminDesignsRouter.patch("/designs/:id", async (req, res, next) => {
  try {
    const data = designSchema.parse(req.body);

    const existing = await prisma.design.findUnique({
      where: { id: req.params.id },
      select: { id: true, imageUrl: true },
    });
    if (!existing) throw new NotFoundError("Design not found");

    const design = await prisma.$transaction(async (tx) => {
      await tx.designVariantCompat.deleteMany({ where: { designId: req.params.id } });
      await tx.designCategory.deleteMany({ where: { designId: req.params.id } });
      return tx.design.update({
        where: { id: req.params.id },
        data: {
          ...buildDesignMetadata(data),
          compat: { create: buildDesignCompatRows(data.compatibleKinds) },
          categories: { create: buildDesignCategoriesCreate(data.categoryIds) },
        },
        include: designInclude,
      });
    });

    // If the imageUrl changed, sweep the old R2 key (best-effort, orphans on failure).
    if (existing.imageUrl && existing.imageUrl !== design.imageUrl) {
      const oldKey = extractKeyFromUrl(existing.imageUrl);
      if (oldKey) {
        const { failed } = await deleteImageKeys([oldKey]);
        if (failed.length > 0) {
          console.warn("[r2] orphaned key after design update", {
            designId: existing.id,
            failed,
          });
        }
      }
    }

    res.json({ design: serializeDesignAdmin(design) });
  } catch (err) {
    next(err);
  }
});

adminDesignsRouter.delete("/designs/:id", async (req, res, next) => {
  try {
    const existing = await prisma.design.findUnique({
      where: { id: req.params.id },
      select: { id: true, imageUrl: true },
    });
    if (!existing) throw new NotFoundError("Design not found");

    const productCount = await prisma.productDesign.count({
      where: { designId: req.params.id },
    });
    if (productCount > 0) {
      throw new ConflictError(
        "DESIGN_IN_USE",
        `Este diseño está asignado a ${productCount} producto(s). Quítalo de esos productos antes de eliminarlo.`,
      );
    }

    await prisma.design.delete({ where: { id: req.params.id } });

    if (existing.imageUrl) {
      const key = extractKeyFromUrl(existing.imageUrl);
      if (key) {
        const { failed } = await deleteImageKeys([key]);
        if (failed.length > 0) {
          console.warn("[r2] orphaned key after design delete", {
            designId: existing.id,
            failed,
          });
        }
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
