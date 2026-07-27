import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// This config builds the Dashboard (Popup/Options page)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/yahoo-api': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-api/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      }
    }
  },
  build: {
    outDir: "../extension",
    emptyOutDir: true, // Clear the extension folder before building
    chunkSizeWarningLimit: 1000,
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
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
  },
});

