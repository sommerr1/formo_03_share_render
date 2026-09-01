import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("./viewer", import.meta.url));

export default defineConfig({
  plugins: [react()],
  root,
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
