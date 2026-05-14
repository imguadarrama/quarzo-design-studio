import { VariantKind } from "@prisma/client";

export const VARIANT_KIND_ORDER: VariantKind[] = [
  VariantKind.CON_FOIL,
  VariantKind.CON_TINTA_NORMAL,
  VariantKind.CON_FOIL_Y_TINTA,
  VariantKind.PAPEL_TEXTURIZADO,
];

export const VARIANT_KIND_NAMES: Record<VariantKind, string> = {
  CON_FOIL: "Con foil",
  CON_TINTA_NORMAL: "Con tinta normal",
  CON_FOIL_Y_TINTA: "Con foil y tinta normal",
  PAPEL_TEXTURIZADO: "Papel texturizado",
};
