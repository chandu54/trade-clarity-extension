import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// This config builds the Dashboard (Popup/Options page)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../extension",
    emptyOutDir: true, // Clear the extension folder before building
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, "dashboard.html"),
        background: resolve(__dirname, "src/background.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") return "background.js";
          return "[name].bundle.js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
