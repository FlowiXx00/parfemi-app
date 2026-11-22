import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for the business logic (prices, coupons, shipping, bundles, IPS QR…), no browser or database. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
