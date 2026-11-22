import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests in a real browser: shop → perfume → cart → coupon → checkout → confirmation.
 * Locally it uses the installed Chrome and an already running `npm run dev` (or starts one).
 * Order submission and coupon checks are intercepted (no real orders are created).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "chrome" }) },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], ...(process.env.CI ? {} : { channel: "chrome" }) },
    },
  ],
  // E2E_BASE_URL = test against an already running site (e.g. a Vercel preview), no local server
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: process.env.CI ? `npm run start -- -p ${PORT}` : "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
