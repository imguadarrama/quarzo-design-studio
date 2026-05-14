import { VariantKind } from "@prisma/client";

export const VARIANT_PALETTE_SLUG: Partial<Record<VariantKind, string>> = {
  CON_FOIL: "colores-foil",
  CON_FOIL_Y_TINTA: "colores-foil",
};

export const PROTECTED_PALETTE_SLUGS = new Set(
  Object.values(VARIANT_PALETTE_SLUG).filter((s): s is string => Boolean(s)),
);
