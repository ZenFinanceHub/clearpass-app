import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*": ["./*"] path alias — without this, any
// test that imports a component/module via "@/..." (the same way the app
// code itself does) can't resolve it; Vite/vitest doesn't read tsconfig
// paths on its own.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
