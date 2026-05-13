import type { DesignInput } from "./validation-schemas.js";

export const buildDesignMetadata = (input: DesignInput) => ({
  name: input.name,
  imageUrl: input.imageUrl,
  active: input.active,
  ...(input.position !== undefined ? { position: input.position } : {}),
});

export const buildDesignCompatRows = (kinds: DesignInput["compatibleKinds"]) =>
  kinds.map((kind) => ({ kind }));
