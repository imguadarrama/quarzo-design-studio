import type { CategoryInput } from "./validation-schemas.js";

export const buildCategoryMetadata = (input: CategoryInput) => ({
  name: input.name,
  slug: input.slug,
  active: input.active,
  ...(input.position !== undefined ? { position: input.position } : {}),
});
