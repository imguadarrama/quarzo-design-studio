import type {
  AdminOptionPalette,
  PalettePayload,
  OptionSwatchPayload,
} from "@/lib/types";
import type { PaletteFormSwatch, PaletteFormValues } from "./schema.js";

export function paletteToFormValues(
  palette: AdminOptionPalette,
): PaletteFormValues {
  return {
    name: palette.name,
    slug: palette.slug,
    active: palette.active,
    swatches: palette.swatches.map((s) => ({
      name: s.name,
      imageUrl: s.imageUrl,
      active: s.active,
    })),
  };
}

function swatchToPayload(swatch: PaletteFormSwatch): OptionSwatchPayload {
  return {
    name: swatch.name,
    imageUrl: swatch.imageUrl,
    active: swatch.active,
  };
}

export function formValuesToPayload(values: PaletteFormValues): PalettePayload {
  return {
    name: values.name,
    slug: values.slug,
    active: values.active,
    swatches: values.swatches.map(swatchToPayload),
  };
}
