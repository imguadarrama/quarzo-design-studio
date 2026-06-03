import { describe, it, expect } from "vitest";
import { formatMxn } from "./format";

describe("formatMxn", () => {
  it("formats with the MXN currency symbol and thousands separators", () => {
    const formatted = formatMxn(1500);
    expect(formatted).toMatch(/^\$/);
    expect(formatted).toContain("1,500");
  });

  it("drops fractional digits", () => {
    expect(formatMxn(1500)).not.toContain(".00");
  });

  it("formats zero", () => {
    expect(formatMxn(0)).toContain("0");
  });
});
