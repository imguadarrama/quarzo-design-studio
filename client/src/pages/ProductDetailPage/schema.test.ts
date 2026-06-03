import { describe, it, expect } from "vitest";
import { pickerSchema } from "./schema";

const validBase = {
  designId: "d1",
  variantKind: "CON_TINTA_NORMAL" as const,
  foilSwatchId: null,
  personalizationText: "Ana García",
  quantity: 1,
};

describe("pickerSchema — foil-swatch superRefine", () => {
  it("accepts a non-foil variant with a null foilSwatchId", () => {
    expect(pickerSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects a foil variant when no swatch is chosen", () => {
    const result = pickerSchema.safeParse({
      ...validBase,
      variantKind: "CON_FOIL",
      foilSwatchId: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "foilSwatchId",
      );
      expect(issue?.message).toBe("Elige un color de foil");
    }
  });

  it("accepts a foil variant once a swatch is chosen", () => {
    const result = pickerSchema.safeParse({
      ...validBase,
      variantKind: "CON_FOIL",
      foilSwatchId: "swatch-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a quantity above 999", () => {
    expect(
      pickerSchema.safeParse({ ...validBase, quantity: 1000 }).success,
    ).toBe(false);
  });

  it("rejects blank personalization text", () => {
    expect(
      pickerSchema.safeParse({ ...validBase, personalizationText: "   " })
        .success,
    ).toBe(false);
  });
});
