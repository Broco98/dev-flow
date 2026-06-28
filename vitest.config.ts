import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest 4 removed the `workspace` API. Each package owns a vitest.config.ts.
  test: { projects: ["packages/*"] },
});
