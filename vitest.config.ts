import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["packages/**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
  resolve: {
    alias: {
      "@platform/auth-client": path.resolve(__dirname, "packages/auth-client/src"),
      "@platform/app-shared": path.resolve(__dirname, "packages/app-shared/src"),
    },
  },
});
