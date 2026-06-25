import { defineConfig } from "vite";
import path from "path";

const extRoot = path.resolve(__dirname);
const projectRoot = path.resolve(__dirname, "..");

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  build: {
    outDir: path.resolve(extRoot, "dist"),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(extRoot, "src/content/floating-capture.ts"),
      name: "WebCollectFloatingCapture",
      formats: ["iife"],
      fileName: () => "assets/floating-capture.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
