import { defineConfig, devices } from "@playwright/test";

// E2E runs against the already-running Compose stack (`pnpm dev`). No
// `webServer` block — the app lives in Docker, not a Playwright-managed server.
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
