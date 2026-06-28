import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "packages/**/__tests__/**/*.{test,spec}.{ts,tsx}",
      "apps/**/__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    globals: true,
  },
  resolve: {
    alias: {
      "@platform/auth-client": path.resolve(__dirname, "packages/auth-client/src"),
      "@platform/app-shared": path.resolve(__dirname, "packages/app-shared/src"),
      "@platform/api-client": path.resolve(__dirname, "packages/api-client/src"),
      "@settings/mfe/lib": path.resolve(__dirname, "apps/mfe-settings/src/lib"),
      "@settings/mfe": path.resolve(__dirname, "apps/mfe-settings/src"),
      "@case-study/mfe/lib": path.resolve(__dirname, "apps/mfe-case-study/src/lib"),
      "@case-study/mfe": path.resolve(__dirname, "apps/mfe-case-study/src"),
    },
  },
});
