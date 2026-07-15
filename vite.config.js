import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// Expose the package version so the app can show a visible build stamp.
const pkgVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url))).version;

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkgVersion) },
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("react-router")) {
            return "vendor";
          }
          if (id.includes("node_modules/qrcode")) return "qr";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      "/api": { target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});
