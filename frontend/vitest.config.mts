import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// `.mts` (not `.ts`): Vite's upcoming default `configLoader: "native"` hands the
// config file to Node directly, which reads a bare `.ts` next to a CommonJS
// package.json as CJS and then chokes on the ESM syntax below.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(import.meta.dirname, ".") } },
  test: { environment: "node", include: ["**/*.test.ts", "**/*.test.tsx"] },
});
