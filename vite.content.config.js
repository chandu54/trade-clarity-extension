import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// This config builds the Content Script (Injected Widget)
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": '"production"', // Hardcode production mode for React
  },
  build: {
    outDir: "../extension",
    emptyOutDir: false, // Do NOT clear, or we delete the dashboard we just built
    lib: {
      entry: resolve(__dirname, "src/content/index.jsx"),
      name: "TradeClarityContent",
      fileName: () => "content.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          return "content.css";
        },
      },
    },
  },
});
