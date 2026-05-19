import type { ProductVariantPrice, VariantKind } from "./types";

export const VARIANT_KIND_ORDER: readonly VariantKind[] = [
  "CON_FOIL",
  "CON_TINTA_NORMAL",
  "CON_FOIL_Y_TINTA",
  "PAPEL_TEXTURIZADO",
];

export const VARIANT_KIND_LABELS: Record<VariantKind, string> = {
  CON_FOIL: "Con foil",
  CON_TINTA_NORMAL: "Con tinta normal",
  CON_FOIL_Y_TINTA: "Con foil y tinta normal",
  PAPEL_TEXTURIZADO: "Papel texturizado",
};

export const VARIANT_KIND_LABELS_SHORT: Record<VariantKind, string> = {
  CON_FOIL: "Foil",
  CON_TINTA_NORMAL: "Tinta",
  CON_FOIL_Y_TINTA: "Foil + Tinta",
  PAPEL_TEXTURIZADO: "Texturizado",
};

export function isFoilKind(kind: VariantKind): boolean {
  return kind === "CON_FOIL" || kind === "CON_FOIL_Y_TINTA";
}

// A foil variant with no palette swatches has no way for the customer to
// choose a foil color, so the picker treats it as unselectable.
export function isSelectableVariant(variant: ProductVariantPrice): boolean {
  if (!isFoilKind(variant.kind)) return true;
  return (variant.palette?.swatches.length ?? 0) > 0;
}
