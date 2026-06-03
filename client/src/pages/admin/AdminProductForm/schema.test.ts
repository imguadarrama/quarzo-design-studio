import { describe, it, expect } from "vitest";
import { productFormSchema } from "./schema";

const variants = [
  { kind: "CON_FOIL" as const, price: 150, offered: true },
  { kind: "CON_TINTA_NORMAL" as const, price: 0, offered: false },
  { kind: "CON_FOIL_Y_TINTA" as const, price: 0, offered: false },
  { kind: "PAPEL_TEXTURIZADO" as const, price: 0, offered: false },
];

const validBase = {
  name: "Tarjeta de boda",
  slug: "tarjeta-de-boda",
  categoryId: "cat-1",
  description: "Una tarjeta personalizada",
  active: true,
  images: [],
  variants,
  designIds: [],
};

describe("productFormSchema — variants", () => {
  it("accepts 4 variants with at least one offered at a positive price", () => {
    expect(productFormSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects when no variant is offered", () => {
    const result = productFormSchema.safeParse({
      ...validBase,
      variants: variants.map((v) => ({ ...v, price: 0, offered: false })),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Al menos una variante debe estar marcada como ofrecida",
      );
    }
  });

  it("rejects an offered variant priced at zero", () => {
    const result = productFormSchema.safeParse({
      ...validBase,
      variants: [
        { kind: "CON_FOIL" as const, price: 0, offered: true },
        ...variants.slice(1),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires exactly 4 variant rows", () => {
    const result = productFormSchema.safeParse({
      ...validBase,
      variants: variants.slice(0, 3),
    });
    expect(result.success).toBe(false);
  });
});
