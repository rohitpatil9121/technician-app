import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
