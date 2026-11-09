// E2E-test af bjarvik.com i Chromium (e2e/). Serveren er server.mjs, som serverer repoet som Simply.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4600;
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "test-resultater/e2e" }]] : "list",
  outputDir: "test-resultater/e2e-spor",
  use: { baseURL: `http://127.0.0.1:${PORT}/`, trace: "retain-on-failure" },
  projects: [
    { name: "computer", use: { ...devices["Desktop Chrome"] } },
    { name: "mobil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node server.mjs", url: `http://127.0.0.1:${PORT}/`, env: { PORT: String(PORT) }, reuseExistingServer: !process.env.CI },
});
