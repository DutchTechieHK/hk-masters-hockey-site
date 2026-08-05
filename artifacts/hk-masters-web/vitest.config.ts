import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure utility tests — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.{js,ts}"],
  },
});
