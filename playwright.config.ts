import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4321);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalTeardown: "./e2e/global-teardown.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      grepInvert: /@mobile/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Serves the production build output (run `npm run build` first; `npm run test:e2e` does this).
        // The server reads DATABASE_URL from .env locally. Render provides it as an environment variable.
        command: "node --env-file-if-exists=.env ./dist/server/entry.mjs",
        url: baseURL,
        env: { HOST: "127.0.0.1", PORT: String(port) },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
