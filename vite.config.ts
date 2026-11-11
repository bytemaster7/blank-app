import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // viteSingleFile packs the whole app (code, styles, fonts) into one HTML file that opens by double-click.
  plugins: [react(), viteSingleFile()],
  server: { open: true },
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
