import { defineConfig } from "vitest/config";

// Tests run under Vite (bundler resolution), so they import without the `.js`
// extension the NodeNext source uses, and are excluded from the tsc build.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
