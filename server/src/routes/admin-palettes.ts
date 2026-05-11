import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  paletteInclude,
  serializePaletteAdmin,
} from "../lib/serializers.js";
import { palettePayloadSchema } from "../lib/validation-schemas.js";
import {
  buildPaletteMetadata,
  buildSwatchesCreate,
} from "../lib/palette-write.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

export const adminPalettesRouter = Router();

adminPalettesRouter.use(authenticateAdmin, requireAdmin);

adminPalettesRouter.get("/palettes", async (_req, res, next) => {
  try {
    const palettes = await prisma.optionPalette.findMany({
      include: paletteInclude,
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    res.json({ palettes: palettes.map(serializePaletteAdmin) });
  } catch (err) {
    next(err);
  }
});

adminPalettesRouter.get("/palettes/:id", async (req, res, next) => {
  try {
    const palette = await prisma.optionPalette.findUnique({
      where: { id: req.params.id },
      include: paletteInclude,
    });
    if (!palette) throw new NotFoundError("Palette not found");
    res.json({ palette: serializePaletteAdmin(palette) });
  } catch (err) {
    next(err);
  }
});

adminPalettesRouter.post("/palettes", async (req, res, next) => {
  try {
    const data = palettePayloadSchema.parse(req.body);

    const palette = await prisma.optionPalette.create({
      data: {
        ...buildPaletteMetadata(data),
        swatches: { create: buildSwatchesCreate(data.swatches) },
      },
      include: paletteInclude,
    });

    res.status(201).json({ palette: serializePaletteAdmin(palette) });
  } catch (err) {
    next(err);
  }
});

adminPalettesRouter.patch("/palettes/:id", async (req, res, next) => {
  try {
    const data = palettePayloadSchema.parse(req.body);

    const existing = await prisma.optionPalette.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Palette not found");

    const palette = await prisma.$transaction(async (tx) => {
      await tx.optionSwatch.deleteMany({ where: { paletteId: req.params.id } });
      return tx.optionPalette.update({
        where: { id: req.params.id },
        data: {
          ...buildPaletteMetadata(data),
          swatches: { create: buildSwatchesCreate(data.swatches) },
        },
        include: paletteInclude,
      });
    });

    res.json({ palette: serializePaletteAdmin(palette) });
  } catch (err) {
    next(err);
  }
});

adminPalettesRouter.delete("/palettes/:id", async (req, res, next) => {
  try {
    const existing = await prisma.optionPalette.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Palette not found");

    const refCount = await prisma.productVariantOption.count({
      where: { paletteId: req.params.id },
    });
    if (refCount > 0) {
      throw new ConflictError(
        "PALETTE_IN_USE",
        "Esta paleta está en uso por uno o más productos. Desactívala o desvincúlala primero.",
      );
    }

    await prisma.optionPalette.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
