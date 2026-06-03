import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("strips combining diacritics", () => {
    expect(slugify("Diseño de café")).toBe("diseno-de-cafe");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugify("hello  world!!next")).toBe("hello-world-next");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  -hello- ")).toBe("hello");
  });

  it("lowercases the result", () => {
    expect(slugify("UPPERCASE")).toBe("uppercase");
  });

  it("returns an empty string for all-punctuation input", () => {
    expect(slugify("!!!")).toBe("");
  });
});
