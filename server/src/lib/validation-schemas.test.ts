import { describe, it, expect } from "vitest";
import { designSchema, productSchema, createOrderItemSchema } from "./validation-schemas";

// Regression guard for the prod-only "Invalid cuid" bug: FK-reference IDs must
// be validated by presence, not generator format. Production categories created
// by a migration backfill have UUID-format IDs; fresh DBs have cuid-format IDs.
const UUID = "a1b2c3d4-5e6f-4a8b-9c0d-ef1234567890";
const CUID = "clxq2k9p70000abcd1234efgh";

const validImage = "https://example.com/design.jpg";

const validVariants = [
  { kind: "CON_FOIL" as const, price: 250, offered: true },
  { kind: "CON_TINTA_NORMAL" as const, price: 200, offered: true },
  { kind: "CON_FOIL_Y_TINTA" as const, price: 290, offered: true },
  { kind: "PAPEL_TEXTURIZADO" as const, price: 230, offered: true },
];

describe("designSchema categoryIds", () => {
  it.each([
    ["UUID-format", UUID],
    ["cuid-format", CUID],
    ["arbitrary non-empty", "anything-non-empty"],
  ])("accepts a %s category id", (_label, id) => {
    const result = designSchema.safeParse({
      name: "Floral",
      imageUrl: validImage,
      categoryIds: [id],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string category id", () => {
    const result = designSchema.safeParse({
      name: "Floral",
      imageUrl: validImage,
      categoryIds: [""],
    });
    expect(result.success).toBe(false);
  });
});

describe("productSchema designIds", () => {
  const base = {
    slug: "tarjetas-boda",
    name: "Tarjetas de boda",
    description: "Tarjetas personalizadas para boda.",
    categoryId: UUID,
    variants: validVariants,
  };

  it.each([
    ["UUID-format", UUID],
    ["cuid-format", CUID],
  ])("accepts a %s design id", (_label, id) => {
    const result = productSchema.safeParse({ ...base, designIds: [id] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string design id", () => {
    const result = productSchema.safeParse({ ...base, designIds: [""] });
    expect(result.success).toBe(false);
  });
});

describe("createOrderItemSchema reference ids", () => {
  it("accepts UUID-format productId, designId, and foilSwatchId", () => {
    const result = createOrderItemSchema.safeParse({
      productId: UUID,
      variantKind: "CON_FOIL",
      designId: UUID,
      foilSwatchId: UUID,
      personalizationText: "Ana López",
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("allows a null foilSwatchId", () => {
    const result = createOrderItemSchema.safeParse({
      productId: CUID,
      variantKind: "CON_TINTA_NORMAL",
      designId: CUID,
      foilSwatchId: null,
      personalizationText: "Ana López",
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });
});
