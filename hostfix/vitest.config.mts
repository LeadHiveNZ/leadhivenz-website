import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Understand the "@/..." and "@config/..." shortcuts from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      // "server-only" stops server code being bundled for the browser. Tests run
      // outside that bundler, so swap it for an empty file.
      "server-only": path.resolve(here, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Removes real keys from the test run. See the note in that file.
    setupFiles: ["tests/setup.ts"],
    // Tests must never read real secrets from this computer.
    env: { NODE_ENV: "test" },
    restoreMocks: true,
    unstubEnvs: true,
  },
});
