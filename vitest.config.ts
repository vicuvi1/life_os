import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests target the pure logic in lib/ (no DOM). The `@/…` alias mirrors
// tsconfig so tests import modules the same way the app does.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
