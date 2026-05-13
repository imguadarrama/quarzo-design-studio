import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { categoryInclude, serializeCategoryAdmin } from "../lib/serializers.js";
import { categorySchema } from "../lib/validation-schemas.js";
import { buildCategoryMetadata } from "../lib/category-write.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

export const adminCategoriesRouter = Router();

adminCategoriesRouter.use(authenticateAdmin, requireAdmin);

adminCategoriesRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: categoryInclude,
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    res.json({ categories: categories.map(serializeCategoryAdmin) });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.get("/categories/:id", async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: categoryInclude,
    });
    if (!category) throw new NotFoundError("Category not found");
    res.json({ category: serializeCategoryAdmin(category) });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.post("/categories", async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: buildCategoryMetadata(data),
      include: categoryInclude,
    });
    res.status(201).json({ category: serializeCategoryAdmin(category) });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.patch("/categories/:id", async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Category not found");

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: buildCategoryMetadata(data),
      include: categoryInclude,
    });
    res.json({ category: serializeCategoryAdmin(category) });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Category not found");

    const productCount = await prisma.product.count({
      where: { categoryId: req.params.id },
    });
    if (productCount > 0) {
      throw new ConflictError(
        "CATEGORY_IN_USE",
        `Esta categoría está asignada a ${productCount} producto(s). Reasigna esos productos antes de eliminarla.`,
      );
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
