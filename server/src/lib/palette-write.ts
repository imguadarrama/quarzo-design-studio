import type { PaletteInput } from "./validation-schemas.js";

export const buildSwatchesCreate = (swatches: PaletteInput["swatches"]) =>
  swatches.map((swatch, index) => ({
    name: swatch.name,
    imageUrl: swatch.imageUrl,
    active: swatch.active,
    position: index,
  }));

export const buildPaletteMetadata = (input: PaletteInput) => ({
  name: input.name,
  slug: input.slug,
  active: input.active,
});
