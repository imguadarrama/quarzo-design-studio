import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement the blob URL helpers the pending-image hooks call.
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
  }
});

afterEach(() => {
  cleanup();
});
